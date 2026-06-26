const express = require('express');
const router = express.Router();

router.use('/auth',  require('./auth.routes'));
router.use('/tasks', require('./task.routes'));
router.use('/stats', require('./stats.routes'));

module.exports = router;