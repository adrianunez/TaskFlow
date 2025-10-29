const db = require('../config/database');

// @desc    Obtener todas las tareas de un proyecto
// @route   GET /api/projects/:projectId/tasks
// @access  Private
exports.getTasksByProject = async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user.id;

    // Verificar acceso al proyecto
    const [membership] = await db.query(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a este proyecto'
      });
    }

    // Obtener boards con columnas y tareas
    const [boards] = await db.query(`
      SELECT 
        b.id as board_id,
        b.name as board_name,
        b.position as board_position
      FROM boards b
      WHERE b.project_id = ?
      ORDER BY b.position
    `, [projectId]);

    for (let board of boards) {
      // Obtener columnas del board
      const [columns] = await db.query(`
        SELECT 
          bc.id,
          bc.name,
          bc.position,
          bc.color
        FROM board_columns bc
        WHERE bc.board_id = ?
        ORDER BY bc.position
      `, [board.board_id]);

      for (let column of columns) {
        // Obtener tareas de cada columna
        const [tasks] = await db.query(`
          SELECT 
            t.*,
            u.full_name as creator_name,
            GROUP_CONCAT(DISTINCT ta_user.full_name) as assigned_users,
            GROUP_CONCAT(DISTINCT ta.user_id) as assigned_user_ids,
            COUNT(DISTINCT c.id) as comments_count
          FROM tasks t
          INNER JOIN users u ON t.created_by = u.id
          LEFT JOIN task_assignments ta ON t.id = ta.task_id
          LEFT JOIN users ta_user ON ta.user_id = ta_user.id
          LEFT JOIN comments c ON t.id = c.task_id
          WHERE t.column_id = ?
          GROUP BY t.id
          ORDER BY t.position
        `, [column.id]);

        column.tasks = tasks;
      }

      board.columns = columns;
    }

    res.json({
      success: true,
      boards
    });
  } catch (error) {
    console.error('Error en getTasksByProject:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tareas'
    });
  }
};

// @desc    Crear nueva tarea
// @route   POST /api/tasks
// @access  Private
exports.createTask = async (req, res) => {
  try {
    const { column_id, title, description, priority, due_date, assigned_users } = req.body;
    const userId = req.user.id;

    if (!column_id || !title) {
      return res.status(400).json({
        success: false,
        message: 'Column ID y título son requeridos'
      });
    }

    // Obtener la última posición
    const [lastTask] = await db.query(
      'SELECT MAX(position) as max_position FROM tasks WHERE column_id = ?',
      [column_id]
    );
    const position = (lastTask[0].max_position || -1) + 1;

    // Crear tarea
    const [result] = await db.query(
      'INSERT INTO tasks (column_id, title, description, priority, due_date, created_by, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [column_id, title, description, priority, due_date, userId, position]
    );

    const taskId = result.insertId;

    // Asignar usuarios si se especificaron
    if (assigned_users && assigned_users.length > 0) {
      for (const assignedUserId of assigned_users) {
        await db.query(
          'INSERT INTO task_assignments (task_id, user_id) VALUES (?, ?)',
          [taskId, assignedUserId]
        );
      }
    }

    const [newTask] = await db.query(
      'SELECT t.*, u.full_name as creator_name FROM tasks t INNER JOIN users u ON t.created_by = u.id WHERE t.id = ?',
      [taskId]
    );

    res.status(201).json({
      success: true,
      message: 'Tarea creada exitosamente',
      task: newTask[0]
    });
  } catch (error) {
    console.error('Error en createTask:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear tarea'
    });
  }
};

// @desc    Actualizar tarea
// @route   PUT /api/tasks/:id
// @access  Private
exports.updateTask = async (req, res) => {
  try {
    const taskId = req.params.id;
    const { title, description, priority, due_date, assigned_users } = req.body;

    await db.query(
      'UPDATE tasks SET title = ?, description = ?, priority = ?, due_date = ? WHERE id = ?',
      [title, description, priority, due_date, taskId]
    );

    // Actualizar asignaciones si se proporcionaron
    if (assigned_users !== undefined) {
      // Eliminar asignaciones anteriores
      await db.query('DELETE FROM task_assignments WHERE task_id = ?', [taskId]);
      
      // Agregar nuevas asignaciones
      if (assigned_users.length > 0) {
        for (const userId of assigned_users) {
          await db.query(
            'INSERT INTO task_assignments (task_id, user_id) VALUES (?, ?)',
            [taskId, userId]
          );
        }
      }
    }

    const [updatedTask] = await db.query(
      'SELECT t.*, u.full_name as creator_name FROM tasks t INNER JOIN users u ON t.created_by = u.id WHERE t.id = ?',
      [taskId]
    );

    res.json({
      success: true,
      message: 'Tarea actualizada exitosamente',
      task: updatedTask[0]
    });
  } catch (error) {
    console.error('Error en updateTask:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar tarea'
    });
  }
};

// @desc    Mover tarea (cambiar columna/posición)
// @route   PUT /api/tasks/:id/move
// @access  Private
exports.moveTask = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const taskId = req.params.id;
    const { column_id, position } = req.body;

    console.log('Moviendo tarea:', { taskId, column_id, position });

    // Validar datos
    if (!column_id || position === undefined) {
      return res.status(400).json({
        success: false,
        message: 'column_id y position son requeridos'
      });
    }

    await connection.beginTransaction();

    // Obtener info actual de la tarea
    const [currentTask] = await connection.query(
      'SELECT column_id, position FROM tasks WHERE id = ?',
      [taskId]
    );

    if (currentTask.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Tarea no encontrada'
      });
    }

    const oldColumnId = currentTask[0].column_id;
    const oldPosition = currentTask[0].position;

    console.log('Posición anterior:', { oldColumnId, oldPosition });
    console.log('Nueva posición:', { column_id, position });

    // Si cambió de columna
    if (oldColumnId !== column_id) {
      // Actualizar posiciones en columna anterior (llenar el hueco)
      await connection.query(
        'UPDATE tasks SET position = position - 1 WHERE column_id = ? AND position > ?',
        [oldColumnId, oldPosition]
      );

      // Hacer espacio en nueva columna
      await connection.query(
        'UPDATE tasks SET position = position + 1 WHERE column_id = ? AND position >= ?',
        [column_id, position]
      );

      // Actualizar la tarea movida
      await connection.query(
        'UPDATE tasks SET column_id = ?, position = ? WHERE id = ?',
        [column_id, position, taskId]
      );
    } else {
      // Mismo columna, solo cambió posición
      if (position > oldPosition) {
        // Mover hacia abajo
        await connection.query(
          'UPDATE tasks SET position = position - 1 WHERE column_id = ? AND position > ? AND position <= ?',
          [column_id, oldPosition, position]
        );
      } else if (position < oldPosition) {
        // Mover hacia arriba
        await connection.query(
          'UPDATE tasks SET position = position + 1 WHERE column_id = ? AND position >= ? AND position < ?',
          [column_id, position, oldPosition]
        );
      }

      // Actualizar la tarea movida
      await connection.query(
        'UPDATE tasks SET position = ? WHERE id = ?',
        [position, taskId]
      );
    }

    await connection.commit();

    console.log('Tarea movida exitosamente');

    res.json({
      success: true,
      message: 'Tarea movida exitosamente'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error en moveTask:', error);
    res.status(500).json({
      success: false,
      message: 'Error al mover tarea',
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// @desc    Eliminar tarea
// @route   DELETE /api/tasks/:id
// @access  Private
exports.deleteTask = async (req, res) => {
  try {
    const taskId = req.params.id;

    // Obtener info de la tarea
    const [task] = await db.query(
      'SELECT column_id, position FROM tasks WHERE id = ?',
      [taskId]
    );

    if (task.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tarea no encontrada'
      });
    }

    // Eliminar tarea
    await db.query('DELETE FROM tasks WHERE id = ?', [taskId]);

    // Actualizar posiciones de tareas restantes
    await db.query(
      'UPDATE tasks SET position = position - 1 WHERE column_id = ? AND position > ?',
      [task[0].column_id, task[0].position]
    );

    res.json({
      success: true,
      message: 'Tarea eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteTask:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar tarea'
    });
  }
};