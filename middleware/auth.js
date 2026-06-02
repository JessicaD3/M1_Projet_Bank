function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  req.flash('error', 'Vous devez être connecté pour accéder à cette page.');
  return res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.is_admin) return next();
  req.flash('error', 'Accès réservé aux administrateurs.');
  return res.redirect('/admin/login');
}

function redirectIfAuth(req, res, next) {
  if (req.session && req.session.user) return res.redirect('/dashboard');
  return next();
}

module.exports = { requireAuth, requireAdmin, redirectIfAuth };