const express = require('express');
const router = express.Router();
const {
  getMyTasks,
  getTaskById,
  submitTask,
  respondToChanges,
  getTaskHistory,
} = require('../../controllers/employeedashboard/task.controller');
const auth = require('../../middleware/auth');

router.get('/',                   auth('employee'), getMyTasks);
router.get('/history',            auth('employee'), getTaskHistory);
router.get('/:id',                auth('employee'), getTaskById);
router.post('/:id/submit',        auth('employee'), submitTask);
router.post('/:id/respond',       auth('employee'), respondToChanges);

module.exports = router;