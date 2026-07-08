const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'API is running...' });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/employee',   require('./routes/employeedashboard/index'));
app.use('/api/superadmin', require('./routes/superadmindashboard/index'));
// app.use('/api/admin',   require('./routes/admindashboard/index'));

// ── Shortcut aliases ──────────────────────────────────────────────────────────
app.use('/api/brands',    require('./routes/superadmindashboard/brandroutes'));
app.use('/api/employees', require('./routes/superadmindashboard/Employeeroutes'));
app.use('/api/tasks',     require('./routes/superadmindashboard/Taskroutes'));
app.use(
  '/api/additional-work',
  require('./routes/superadmindashboard/additionalWorkRoutes')
);
// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong', error: err.message });
});

module.exports = app;