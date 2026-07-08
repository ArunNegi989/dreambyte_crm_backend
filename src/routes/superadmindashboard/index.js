const express = require("express");
const router = express.Router();

const authRoutes = require("./auth.routes");
const brandRoutes = require("./brandroutes");
const employeeRoutes = require("./Employeeroutes");
const taskRoutes = require("./Taskroutes");
const additionalWorkRoutes = require("./additionalWorkRoutes");
router.use("/auth", authRoutes);
router.use("/brands", brandRoutes);
router.use("/employees", employeeRoutes);
router.use("/tasks", taskRoutes);
router.use("/additional-work", additionalWorkRoutes);

module.exports = router;