const express = require("express");
const router = express.Router();

const authRoutes = require("./auth.routes");
const brandRoutes = require("./brandroutes");
const employeeRoutes = require("./Employeeroutes");
const taskRoutes = require("./Taskroutes");
const additionalWorkRoutes = require("./additionalWorkRoutes");
const seoTaskRoutes = require("./seoTaskRoutes");

router.use("/auth", authRoutes);
router.use("/brands", brandRoutes);
router.use("/employees", employeeRoutes);
router.use("/tasks", taskRoutes);
router.use("/additional-work", additionalWorkRoutes);
router.use("/seo", seoTaskRoutes);

module.exports = router;