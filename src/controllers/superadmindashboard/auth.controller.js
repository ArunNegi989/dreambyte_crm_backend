const Employee = require('../../models/superadmindashboard/Employeemodel');
const jwt = require('jsonwebtoken');

// ── Public: check if any superadmin exists ────────────────────────────────────
// Used by the login page to decide whether to show the "Register as superadmin"
// button. No auth required — it only returns a boolean, no sensitive data.
exports.checkSuperAdminExists = async (req, res) => {
  try {
    const exists = await Employee.exists({ role: 'super_admin' });
    res.json({ exists: !!exists });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Register ──────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    // Block registration if a superadmin already exists
    const exists = await Employee.exists({ role: 'super_admin' });
    if (exists) {
      return res.status(403).json({ message: 'A superadmin already exists. Registration is disabled.' });
    }

    const { employeeId, name, email, phone, dob, department, password, joinDate } = req.body;

    if (!employeeId || !name || !email || !dob || !department || !password || !joinDate)
      return res.status(400).json({ message: 'All fields except phone are required.' });

    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });

    const existingEmail = await Employee.findOne({ email });
    if (existingEmail)
      return res.status(409).json({ message: 'An account with this email already exists.' });

    const existingId = await Employee.findOne({ employeeId });
    if (existingId)
      return res.status(409).json({ message: 'An account with this employee ID already exists.' });

    const superAdmin = await Employee.create({
      employeeId, name, email,
      phone: phone || '',
      dob, department, password, joinDate,
      role: 'super_admin',
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: 'Superadmin account created successfully.',
      user: {
        id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        employeeId: superAdmin.employeeId,
        role: superAdmin.role,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(409).json({ message: `${field} is already in use.` });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────
const ROLE_REDIRECTS = {
  employee:    '/dashboard/employeedashboard',
  admin:       '/dashboard/admindashboard',
  super_admin: '/dashboard/superadmindashboard',
};

exports.login = async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    if (!employeeId || !password)
      return res.status(400).json({ message: 'Employee ID and password are required.' });

    const user = await Employee.findOne({ employeeId, role: 'super_admin' });
    if (!user)
      return res.status(401).json({ message: 'Invalid employee ID or password.' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid employee ID or password.' });

    if (!user.isActive)
      return res.status(403).json({ message: 'Account is deactivated. Contact support.' });

    const token = jwt.sign(
      { id: user._id, role: user.role, employeeId: user.employeeId, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      token,
      redirectTo: ROLE_REDIRECTS[user.role],
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId,
        department: user.department,
        phone: user.phone,
        joinDate: user.joinDate,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Profile ───────────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const user = await Employee.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────
exports.logout = (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully.' });
};