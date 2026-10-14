import { ADMIN_EMAIL } from '../utils/ensureAdminUser.js';

/**
 * Express middleware to strictly guard administrative backoffice routes.
 */
export function ensureAdmin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const userEmail = req.user?.email ? req.user.email.toLowerCase() : '';
    const userRole = req.user?.role || '';

    if (userRole === 'admin' && userEmail === ADMIN_EMAIL.toLowerCase()) {
      return next();
    }

    return res.status(403).render('dealError', {
      pageTitle: 'Admin Access Denied — PerPage',
      errorTitle: 'Restricted Backoffice',
      errorCode: '403 Forbidden',
      errorMessage: `Access to the operations backoffice is strictly restricted to platform administrator (${ADMIN_EMAIL}). Your current account does not have administrative privileges.`
    });
  }

  if (req.session) {
    req.session.returnTo = '/admin';
  }
  return res.redirect('/login');
}

export default ensureAdmin;
