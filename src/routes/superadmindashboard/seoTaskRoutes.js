// routes/superadmindashboard/seoTaskRoutes.js
const express = require("express");
const router = express.Router();
const { getMyTasks, getDashboardStats, updateTaskWork,respondToChange } = require("../../controllers/superadmindashboard/seoTaskController");
// const auth = require("../../middleware/auth"); // wire in once secured

router.get("/tasks", getMyTasks);
router.get("/dashboard-stats", getDashboardStats);
router.put("/tasks/:id", updateTaskWork);
router.post("/tasks/:id/respond", respondToChange);
module.exports = router;