const { User } = require('../../models/employeedashboard/index');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    console.log(employeeId," ", password)

    if (!employeeId || !password)
      return res.status(400).json({ message: 'Employee ID and password are required' });

    const user = await User.findOne({ employeeId });
    if (!user)
      return res.status(401).json({ message: 'Invalid employee ID or password' });

    const isMatch = await user.matchPassword(password);

    if (!isMatch)
      return res.status(401).json({ message: 'Invalid employee ID or password' });

    if (!user.isActive)
      return res.status(403).json({ message: 'Account is deactivated. Contact your admin.' });

    const token = jwt.sign(
      { id: user._id, role: user.role, employeeId: user.employeeId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
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
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};