import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, MoreVertical, Trash2, Edit, Calendar, AlertCircle, GripVertical } from 'lucide-react';
import { tasksAPI } from '../services/api';

const KanbanBoard = ({ boards, onUpdate }) => {
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: ''
  });

  const handleDragEnd = async (result) => {
    if (!result.destination) {
      console.log('No hay destino válido');
      return;
    }

    const { source, destination, draggableId } = result;

    // Si no cambió de posición, no hacer nada
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      console.log('Misma posición, no se mueve');
      return;
    }

    console.log('Moviendo tarea:', {
      taskId: draggableId,
      from: source.droppableId,
      to: destination.droppableId,
      position: destination.index
    });

    try {
      const response = await tasksAPI.move(draggableId, {
        column_id: parseInt(destination.droppableId),
        position: destination.index
      });
      console.log('Tarea movida exitosamente:', response.data);
      await onUpdate();
    } catch (error) {
      console.error('Error completo al mover tarea:', error);
      console.error('Respuesta del servidor:', error.response?.data);
      alert('Error al mover la tarea: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await tasksAPI.create({
        ...taskForm,
        column_id: selectedColumn
      });
      setShowTaskModal(false);
      setTaskForm({ title: '', description: '', priority: 'medium', due_date: '' });
      onUpdate();
    } catch (error) {
      console.error('Error al crear tarea:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('¿Estás seguro de eliminar esta tarea?')) {
      try {
        await tasksAPI.delete(taskId);
        onUpdate();
      } catch (error) {
        console.error('Error al eliminar tarea:', error);
      }
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700'
    };
    return colors[priority] || colors.medium;
  };

  const getPriorityText = (priority) => {
    const texts = {
      low: 'Baja',
      medium: 'Media',
      high: 'Alta',
      urgent: 'Urgente'
    };
    return texts[priority] || priority;
  };

  return (
    <div className="flex-1 overflow-x-auto pb-8">
      {boards.map((board) => (
        <div key={board.board_id} className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">{board.board_name}</h2>

          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex space-x-4 min-w-max">
              {board.columns.map((column) => (
                <div key={column.id} className="flex flex-col w-80 bg-gray-100 rounded-xl p-4">
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: column.color }}
                      />
                      <h3 className="font-semibold text-gray-900">{column.name}</h3>
                      <span className="text-sm text-gray-500">({column.tasks.length})</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedColumn(column.id);
                        setShowTaskModal(true);
                      }}
                      className="p-1 hover:bg-gray-200 rounded transition"
                    >
                      <Plus className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={column.id.toString()}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 space-y-3 min-h-[200px] p-2 rounded-lg transition-all ${
                          snapshot.isDraggingOver ? 'bg-blue-100 ring-2 ring-blue-400 ring-offset-2' : 'bg-transparent'
                        }`}
                      >
                        {column.tasks.map((task, index) => (
                          <Draggable
                            key={task.id}
                            draggableId={task.id.toString()}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`bg-white rounded-lg p-4 shadow-sm hover:shadow-lg transition border-2 ${
                                  snapshot.isDragging 
                                    ? 'shadow-2xl ring-2 ring-blue-500 rotate-2 scale-105 border-blue-500' 
                                    : 'border-transparent hover:border-blue-200'
                                }`}
                              >
                                {/* Drag Handle */}
                                <div 
                                  {...provided.dragHandleProps}
                                  className="flex items-center mb-2 cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical className="w-4 h-4 text-gray-400 hover:text-blue-500 transition" />
                                  <span className="text-xs text-gray-400 ml-1 select-none">Arrastra para mover</span>
                                </div>
                                {/* Task Header */}
                                <div className="flex items-start justify-between mb-2 select-none">
                                  <h4 className="font-medium text-gray-900 flex-1 pr-2">
                                    {task.title}
                                  </h4>
                                  <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="p-1 hover:bg-red-50 rounded transition flex-shrink-0"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </button>
                                </div>

                                {/* Task Description */}
                                {task.description && (
                                  <p className="text-sm text-gray-600 mb-3 line-clamp-2 select-none">
                                    {task.description}
                                  </p>
                                )}

                                {/* Task Meta */}
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(
                                      task.priority
                                    )}`}
                                  >
                                    {getPriorityText(task.priority)}
                                  </span>

                                  {task.due_date && (
                                    <div className="flex items-center text-xs text-gray-500">
                                      <Calendar className="w-3 h-3 mr-1" />
                                      {new Date(task.due_date).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>

                                {/* Assigned Users */}
                                {task.assigned_users && (
                                  <div className="mt-3 pt-3 border-t border-gray-100">
                                    <p className="text-xs text-gray-500">
                                      Asignado a: {task.assigned_users}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        </div>
      ))}

      {/* Modal Nueva Tarea */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 fade-in">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Nueva Tarea</h2>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nombre de la tarea"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  rows="3"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Descripción de la tarea..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prioridad
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha Límite
                  </label>
                  <input
                    type="date"
                    value={taskForm.due_date}
                    onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Crear Tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KanbanBoard;