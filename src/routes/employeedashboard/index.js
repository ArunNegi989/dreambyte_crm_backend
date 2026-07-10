const express = require('express');
const router  = express.Router();
const auth    = require('../../middleware/auth');
const {
  getTasks,
  getTask,
  submitTask,
  respondToChanges,
  getDashboardStats,
  addSubtask,
  toggleSubtask,
  removeSubtask,
} = require('../../controllers/superadmindashboard/taskController');

router.use('/auth', require('./auth.routes'));

// All task + stats routes require at least employee auth
router.get('/stats',                   auth('employee'), getDashboardStats);
router.get('/tasks',                   auth('employee'), getTasks);
router.get('/tasks/:id',               auth('employee'), getTask);
router.post('/tasks/:id/submit',       auth('employee'), submitTask);
router.post('/tasks/:id/respond',      auth('employee'), respondToChanges);

// ── Subtasks (employee's own checklist) ────────────────────────────────
router.post('/tasks/:id/subtasks',                  auth('employee'), addSubtask);
router.patch('/tasks/:id/subtasks/:subtaskId',      auth('employee'), toggleSubtask);
router.delete('/tasks/:id/subtasks/:subtaskId',     auth('employee'), removeSubtask);

module.exports = router;