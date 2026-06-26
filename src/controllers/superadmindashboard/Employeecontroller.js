const bcrypt = require("bcryptjs");
const Employee = require("../../models/superadmindashboard/Employeemodel");

// Auto-generate unique Employee ID
const generateEmployeeId = async (dob) => {
  const year = new Date(dob).getFullYear();
  const base = `DBS-2021-${year}`;

  // Check how many with same base exist, add suffix if needed
  const count = await Employee.countDocuments({
    employeeId: { $regex: `^${base}` },
  });

  return count === 0 ? base : `${base}-${count + 1}`;
};

// ─── CREATE ─────────────────────────────────────────────────────────────────
exports.createEmployee = async (req, res) => {
  try {
    const { name, email, phone, dob, department, role, password } = req.body;

    if (!name || !email || !dob || !department || !password) {
      return res.status(400).json({
        success: false,
        message: "name, email, dob, department, and password are required",
      });
    }

    // Check duplicate email
    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Employee with this email already exists",
      });
    }

    const employeeId = await generateEmployeeId(dob);
    const joinDate = new Date().toISOString().split("T")[0];

    const employee = await Employee.create({
      employeeId,
      name,
      email,
      phone: phone || "",
      dob,
      department,
      role: role || "employee",
      password, // hashed by pre-save hook
      joinDate,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: {
        employeeId: employee.employeeId,
        password: req.body.password, // plain password returned once for display
        name: employee.name,
        email: employee.email,
        department: employee.department,
        role: employee.role,
        joinDate: employee.joinDate,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET ALL ─────────────────────────────────────────────────────────────────
exports.getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find()
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: employees.length, data: employees });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET ONE ─────────────────────────────────────────────────────────────────
exports.getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).select("-password");

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    res.json({ success: true, data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── UPDATE ──────────────────────────────────────────────────────────────────
exports.updateEmployee = async (req, res) => {
  try {
    const { name, email, phone, department, role, isActive } = req.body;

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, department, role, isActive },
      { new: true, runValidators: true }
    ).select("-password");

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    res.json({ success: true, message: "Employee updated successfully", data: employee });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELETE ──────────────────────────────────────────────────────────────────
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    res.json({ success: true, message: "Employee deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};