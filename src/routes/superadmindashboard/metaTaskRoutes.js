const express = require("express");
const router = express.Router();
const { getMyTasks, getDashboardStats } = require("../../controllers/superadmindashboard/metaTaskController");
// const auth = require("../../middleware/auth"); // wire in once you decide to secure this

router.get("/tasks", getMyTasks);               // ?employeeId=... (or req.user.id once auth middleware is attached)
router.get("/dashboard-stats", getDashboardStats);

// Writes reuse your existing generic task endpoints — no need to duplicate:
//   PUT  /api/tasks/:id          → update status/remark  (updateTask)
//   POST /api/tasks/:id/submit   → employee submits       (submitTask)
//   POST /api/tasks/:id/respond  → employee replies        (respondToChanges)

module.exports = router;