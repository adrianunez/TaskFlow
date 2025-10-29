const db = require('../config/database');

// @desc    Obtener todos los proyectos del usuario
// @route   GET /api/projects
// @access  Private
exports.getProjects = async (req, res) => {
  try {
    const userId = req.user.id;

    const [projects] = await db.query(`
      SELECT 
        p.*,
        u.full_name as owner_name,
        pm.role as user_role,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT pm2.user_id) as total_members
      FROM projects p
      INNER JOIN users u ON p.owner_id = u.id
      INNER JOIN project_members pm ON p.id = pm.project_id
      LEFT JOIN boards b ON p.id = b.project_id
      LEFT JOIN board_columns bc ON b.id = bc.board_id
      LEFT JOIN tasks t ON bc.id = t.column_id
      LEFT JOIN project_members pm2 ON p.id = pm2.project_id
      WHERE pm.user_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      count: projects.length,
      projects
    });
  } catch (error) {
    console.error('Error en getProjects:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proyectos'
    });
  }
};

// @desc    Obtener un proyecto por ID
// @route   GET /api/projects/:id
// @access  Private
exports.getProjectById = async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;

    // Verificar si el usuario es miembro del proyecto
    const [membership] = await db.query(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'No tienes acceso a este proyecto'
      });
    }

    const [projects] = await db.query(`
      SELECT 
        p.*,
        u.full_name as owner_name,
        u.email as owner_email
      FROM projects p
      INNER JOIN users u ON p.owner_id = u.id
      WHERE p.id = ?
    `, [projectId]);

    if (projects.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    // Obtener miembros del proyecto
    const [members] = await db.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.avatar_url,
        pm.role,
        pm.joined_at
      FROM project_members pm
      INNER JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `, [projectId]);

    const project = {
      ...projects[0],
      user_role: membership[0].role,
      members
    };

    res.json({
      success: true,
      project
    });
  } catch (error) {
    console.error('Error en getProjectById:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proyecto'
    });
  }
};

// @desc    Crear nuevo proyecto
// @route   POST /api/projects
// @access  Private
exports.createProject = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { name, description, start_date, end_date } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del proyecto es requerido'
      });
    }

    await connection.beginTransaction();

    // Crear proyecto
    const [projectResult] = await connection.query(
      'INSERT INTO projects (name, description, owner_id, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
      [name, description, userId, start_date, end_date]
    );

    const projectId = projectResult.insertId;

    // Agregar al creador como miembro owner
    await connection.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
      [projectId, userId, 'owner']
    );

    // Crear tablero por defecto
    const [boardResult] = await connection.query(
      'INSERT INTO boards (project_id, name, position) VALUES (?, ?, ?)',
      [projectId, 'Tablero Principal', 0]
    );

    const boardId = boardResult.insertId;

    // Crear columnas por defecto
    const defaultColumns = [
      { name: 'Por Hacer', position: 0, color: '#EF4444' },
      { name: 'En Progreso', position: 1, color: '#F59E0B' },
      { name: 'En Revisión', position: 2, color: '#3B82F6' },
      { name: 'Completado', position: 3, color: '#10B981' }
    ];

    for (const col of defaultColumns) {
      await connection.query(
        'INSERT INTO board_columns (board_id, name, position, color) VALUES (?, ?, ?, ?)',
        [boardId, col.name, col.position, col.color]
      );
    }

    await connection.commit();

    const [newProject] = await connection.query(
      'SELECT * FROM projects WHERE id = ?',
      [projectId]
    );

    res.status(201).json({
      success: true,
      message: 'Proyecto creado exitosamente',
      project: newProject[0]
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error en createProject:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear proyecto'
    });
  } finally {
    connection.release();
  }
};

// @desc    Actualizar proyecto
// @route   PUT /api/projects/:id
// @access  Private
exports.updateProject = async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;
    const { name, description, status, start_date, end_date } = req.body;

    // Verificar permisos (owner o admin)
    const [membership] = await db.query(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );

    if (membership.length === 0 || !['owner', 'admin'].includes(membership[0].role)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para editar este proyecto'
      });
    }

    await db.query(
      'UPDATE projects SET name = ?, description = ?, status = ?, start_date = ?, end_date = ? WHERE id = ?',
      [name, description, status, start_date, end_date, projectId]
    );

    const [updatedProject] = await db.query(
      'SELECT * FROM projects WHERE id = ?',
      [projectId]
    );

    res.json({
      success: true,
      message: 'Proyecto actualizado exitosamente',
      project: updatedProject[0]
    });
  } catch (error) {
    console.error('Error en updateProject:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar proyecto'
    });
  }
};

// @desc    Eliminar proyecto
// @route   DELETE /api/projects/:id
// @access  Private
exports.deleteProject = async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;

    // Verificar que sea el owner
    const [project] = await db.query(
      'SELECT owner_id FROM projects WHERE id = ?',
      [projectId]
    );

    if (project.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    if (project[0].owner_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo el propietario puede eliminar el proyecto'
      });
    }

    await db.query('DELETE FROM projects WHERE id = ?', [projectId]);

    res.json({
      success: true,
      message: 'Proyecto eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteProject:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar proyecto'
    });
  }
};