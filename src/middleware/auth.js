const jwt = require('jsonwebtoken');

// Role hierarchy — higher roles can access lower role routes
const ROLE_HIERARCHY = {
  superadmin: 3,
  admin: 2,
  employee: 1,
};

// Usage:
//   auth()               → just checks if logged in, any role
//   auth('employee')     → employee, admin, superadmin can access
//   auth('admin')        → admin and superadmin only
//   auth('superadmin')   → superadmin only
module.exports = (requiredRole) => (req, res, next) => {
  let token = null;

  // 1. Check Authorization header first
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  }
  // 2. Fall back to cookie
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token)
    return res.status(401).json({ message: 'No token provided. Please log in.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Check role if required
    if (requiredRole) {
      const userLevel = ROLE_HIERARCHY[decoded.role] ?? 0;
      const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;

      if (userLevel < requiredLevel) {
        return res.status(403).json({
          message: `Access denied. Requires ${requiredRole} role or higher.`,
        });
      }
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ message: 'Token expired. Please log in again.' });
    return res.status(401).json({ message: 'Invalid token. Please log in again.' });
  }
};