const express = require("express");
const cors = require("cors");

const employeeRoutes = require("./routes/employeedashboard/index");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running...",
  });
});


// API Routes
app.use("/api", employeeRoutes);

module.exports = app;