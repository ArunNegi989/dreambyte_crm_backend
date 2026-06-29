const express = require('express');
const router = express.Router();
const { login, getProfile, logout } = require('../../controllers/employeedashboard/auth.controller');
const auth = require('../../middleware/auth');

router.post('/login',   login);
router.get('/profile',  auth('employee'), getProfile);
router.post('/logout',  auth('employee'), logout);

module.exports = router;