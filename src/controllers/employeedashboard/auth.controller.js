const Employee = require('../../models/superadmindashboard/Employeemodel');
const jwt = require('jsonwebtoken');

// Map roles to frontend dashboard routes
const ROLE_REDIRECTS = {
  employee:   '/dashboard/employeedashboard',
  admin:      '/dashboard/admindashboard',
  superadmin: '/dashboard/superadmindashboard',
};

exports.login = async (req, res) => {
  try {
    const { employeeId, password } = req.body;
console.log(employeeId, password)
    if (!employeeId || !password)
      return res.status(400).json({ message: 'Employee ID and password are required' });

    const user = await Employee.findOne({ employeeId });
    console.log(user)
    if (!user)
      return res.status(401).json({ message: 'Invalid employee ID or password' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid employee ID or password' });

    if (!user.isActive)
      return res.status(403).json({ message: 'Account is deactivated. Contact your admin.' });

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        employeeId: user.employeeId,
        name: user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Secure httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    res.json({
      success: true,
      token,
      redirectTo: ROLE_REDIRECTS[user.role] || '/dashboard/employeedashboard',
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

exports.getProfile = async (req, res) => {
  try {
    const user = await Employee.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully' });
};