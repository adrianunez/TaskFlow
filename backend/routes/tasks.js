const express = require('express');
const router = express.Router();
const {
  createTask,
  updateTask,
  moveTask,
  deleteTask
} = require('../controllers/tasksController');
const { protect } = require('../middlewares/auth');

// Todas las rutas requieren autenticación
router.use(protect);

router.post('/', createTask);
router.put('/:id', updateTask);
router.put('/:id/move', moveTask);
router.delete('/:id', deleteTask);

module.exports = router;