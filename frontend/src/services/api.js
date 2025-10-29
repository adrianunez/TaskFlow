import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

// Configurar interceptor para manejar errores globalmente
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// PROYECTOS
export const projectsAPI = {
  getAll: () => axios.get(`${API_URL}/projects`),
  getById: (id) => axios.get(`${API_URL}/projects/${id}`),
  create: (data) => axios.post(`${API_URL}/projects`, data),
  update: (id, data) => axios.put(`${API_URL}/projects/${id}`, data),
  delete: (id) => axios.delete(`${API_URL}/projects/${id}`),
  getTasks: (projectId) => axios.get(`${API_URL}/projects/${projectId}/tasks`)
};

// TAREAS
export const tasksAPI = {
  create: (data) => axios.post(`${API_URL}/tasks`, data),
  update: (id, data) => axios.put(`${API_URL}/tasks/${id}`, data),
  move: (id, data) => axios.put(`${API_URL}/tasks/${id}/move`, data),
  delete: (id) => axios.delete(`${API_URL}/tasks/${id}`)
};

export default {
  projects: projectsAPI,
  tasks: tasksAPI
};