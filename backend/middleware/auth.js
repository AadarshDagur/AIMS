const authMiddleware = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    
    if (!allowedRoles.includes(req.session.user.role)) {
      return res.status(403).send('Access denied');
    }
    
    next();
  };
};

module.exports = { authMiddleware, roleMiddleware };