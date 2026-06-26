const express = require('express');
const router = express.Router();
const { login, getProfile } = require('../../controllers/employeedashboard/auth.controller');
const auth = require('../../middleware/auth');

router.post('/login', login);
router.get('/profile', auth('employee'), getProfile);

module.exports = router;