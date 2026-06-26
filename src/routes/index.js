const express = require("express");
const router = express.Router();

const brandRoutes = require("./superadmindashboard/brandroutes");
const employeeRoutes = require("./superadmindashboard/Employeeroutes");

router.use("/brands", brandRoutes);
router.use("/employees", employeeRoutes);

module.exports = router;