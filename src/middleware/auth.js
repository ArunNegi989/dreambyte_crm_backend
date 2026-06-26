const jwt = require('jsonwebtoken');

module.exports = (requiredRole) => (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ message: 'No token provided' });

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    if (requiredRole && decoded.role !== requiredRole && decoded.role !== 'superadmin')
      return res.status(403).json({ message: 'Access denied' });

    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};