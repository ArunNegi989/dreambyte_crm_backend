const express = require("express");
const cors = require("cors");

const employeeRoutes = require("./routes/employeedashboard/index");
const superAdminRoutes = require("./routes/superadmindashboard/index");

const app = express();

app.use(
  cors({
   origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.status(200).json({ success: true, message: "API is running..." });
});

// superAdminRoutes PEHLE — no auth middleware inside
// Covers: /api/brands, /api/employees, /api/tasks
app.use("/api", superAdminRoutes);

// employeeRoutes BAAD — has auth middleware inside individual route files
// Covers: /api/auth, /api/tasks (employee), /api/stats
app.use("/api/employee", employeeRoutes);

module.exports = app;