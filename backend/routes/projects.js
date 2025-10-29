const express = require('express');
const router = express.Router();
const {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject
} = require('../controllers/projectsController');
const { getTasksByProject } = require('../controllers/tasksController');
const { protect } = require('../middlewares/auth');

// Todas las rutas requieren autenticación
router.use(protect);

router.route('/')
  .get(getProjects)
  .post(createProject);

router.route('/:id')
  .get(getProjectById)
  .put(updateProject)
  .delete(deleteProject);

router.get('/:projectId/tasks', getTasksByProject);

module.exports = router;