const express = require('express');
const router  = express.Router();
const auth    = require('../../middleware/auth');
const {
  getTasks,
  getTask,
  submitTask,
  respondToChanges,
  getDashboardStats,
} = require('../../controllers/superadmindashboard/taskController');

router.use('/auth', require('./auth.routes'));

// All task + stats routes require at least employee auth
router.get('/stats',                   auth('employee'), getDashboardStats);
router.get('/tasks',                   auth('employee'), getTasks);
router.get('/tasks/:id',               auth('employee'), getTask);
router.post('/tasks/:id/submit',       auth('employee'), submitTask);
router.post('/tasks/:id/respond',      auth('employee'), respondToChanges);

module.exports = router;