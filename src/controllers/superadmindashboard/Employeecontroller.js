const Employee = require("../../models/superadmindashboard/Employeemodel");

// ─── Helper: Auto-generate Employee ID ───────────────────────────────────────
const generateEmployeeId = async (dob) => {
  const year = new Date(dob).getFullYear();
  const base = `DBS-2021-${year}`;

  const count = await Employee.countDocuments({
    employeeId: { $regex: `^${base}` },
  });

  const suffix = String(count + 1).padStart(3, "0");
  return `${base}-${suffix}`;
};

// ─── CREATE ──────────────────────────────────────────────────────────────────
exports.createEmployee = async (req, res) => {
  try {
    const { name, email, phone, dob, department, role, password } = req.body;

    if (!name || !email || !dob || !department || !password) {
      return res.status(400).json({
        success: false,
        message: "name, email, dob, department, and password are required",
      });
    }

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

    // Return employee data + plain password (shown once in UI)
    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      plainPassword: password,
      data: {
        _id: employee._id,
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        dob: employee.dob,
        department: employee.department,
        role: employee.role,
        joinDate: employee.joinDate,
        isActive: employee.isActive,
        createdAt: employee.createdAt,
        updatedAt: employee.updatedAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field === "email" ? "Email" : "Employee ID"} already exists`,
      });
    }
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
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
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
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }

    res.json({
      success: true,
      message: "Employee updated successfully",
      data: employee,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already in use by another employee",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELETE ──────────────────────────────────────────────────────────────────
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);

    if (!employee) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }

    res.json({ success: true, message: "Employee deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};