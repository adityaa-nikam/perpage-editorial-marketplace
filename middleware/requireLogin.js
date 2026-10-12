/**
 * Middleware ensuring user is authenticated before accessing protected routes.
 * Captures GET request original URL in session.returnTo for post-login return.
 */
export function requireLogin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  // Store returnTo for GET requests only so user returns to what they were browsing
  if (req.method === 'GET' && req.session) {
    req.session.returnTo = req.originalUrl;
  }

  return res.redirect('/login');
}

export default requireLogin;
