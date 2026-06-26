const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../../controllers/employeedashboard/stats.controller');
const auth = require('../../middleware/auth');

router.get('/', auth('employee'), getDashboardStats);

module.exports = router;