import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsAPI } from '../services/api';
import KanbanBoard from '../components/KanbanBoard';
import { ArrowLeft, Settings, Users, Loader2, Calendar, CheckCircle } from 'lucide-react';

const Project = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProject();
    loadTasks();
  }, [id]);

  const loadProject = async () => {
    try {
      const response = await projectsAPI.getById(id);
      setProject(response.data.project);
    } catch (error) {
      console.error('Error al cargar proyecto:', error);
      if (error.response?.status === 403) {
        alert('No tienes acceso a este proyecto');
        navigate('/dashboard');
      }
    }
  };

  const loadTasks = async () => {
    try {
      const response = await projectsAPI.getTasks(id);
      setBoards(response.data.boards);
    } catch (error) {
      console.error('Error al cargar tareas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = () => {
    loadTasks();
  };

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </div>
    );
  }

  // Calcular estadísticas
  const totalTasks = boards.reduce(
    (acc, board) => acc + board.columns.reduce((sum, col) => sum + col.tasks.length, 0),
    0
  );
  const completedColumn = boards[0]?.columns.find(col => col.name.toLowerCase().includes('completado'));
  const completedTasks = completedColumn?.tasks.length || 0;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Volver a Proyectos</span>
          </button>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.name}</h1>
                {project.description && (
                  <p className="text-gray-600 mb-4">{project.description}</p>
                )}

                {/* Project Info */}
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4" />
                    <span>{project.members.length} miembros</span>
                  </div>
                  {project.start_date && (
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(project.start_date).toLocaleDateString()} - 
                        {project.end_date ? new Date(project.end_date).toLocaleDateString() : 'Sin fecha'}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>{totalTasks} tareas totales</span>
                  </div>
                </div>
              </div>

              <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                <Settings className="w-5 h-5" />
                <span>Configuración</span>
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progreso del proyecto</span>
                <span className="text-sm font-medium text-blue-600">{progressPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {completedTasks} de {totalTasks} tareas completadas
              </p>
            </div>

            {/* Team Members */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Equipo</h3>
              <div className="flex flex-wrap gap-2">
                {project.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center space-x-2 bg-gray-100 rounded-full px-3 py-1"
                  >
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-xs text-white font-medium">
                        {member.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm text-gray-700">{member.full_name}</span>
                    <span className="text-xs text-gray-500 px-2 py-0.5 bg-white rounded-full">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        {boards.length > 0 ? (
          <KanbanBoard boards={boards} onUpdate={handleUpdate} />
        ) : (
          <div className="bg-white rounded-2xl shadow-md p-12 text-center">
            <p className="text-gray-500">No hay tableros disponibles</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Project;