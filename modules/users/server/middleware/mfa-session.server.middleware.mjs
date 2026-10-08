import mfaService from '../services/mfa.server.service.mjs';

const allowedMfaPaths = new Set([
  '/api/auth/session',
  '/api/auth/signout',
  '/api/auth/mfa/verify',
  '/api/users/mfa',
  '/api/users/mfa/enrol',
  '/api/users/mfa/enrol/verify',
  '/api/users/mfa/recovery-codes',
  '/api/users/mfa/disable',
]);

function createMfaSessionMiddleware() {
  return function requireMfaForAccountAccess(req, res, next) {
    const user = req.user;
    if (!user) return next();

    const requiresSetup =
      mfaService.isPrivileged(user) && user.mfaEnabled !== true;
    const requiresVerification =
      user.mfaEnabled === true && user.$locals?.mfaVerified !== true;
    if (!requiresSetup && !requiresVerification) return next();

    if (allowedMfaPaths.has(req.path)) return next();

    // Unenrolled staff can reach the account screen to set up MFA. Its normal
    // account APIs remain blocked by this middleware until setup is complete.
    if (
      requiresSetup &&
      req.method === 'GET' &&
      req.path === '/profile/edit/account'
    ) {
      return next();
    }

    if (req.path.startsWith('/api/')) {
      return res.status(403).json({
        message: requiresSetup
          ? 'Set up authenticator MFA before using this account.'
          : 'Verify authenticator MFA before continuing.',
        mfaRequired: true,
      });
    }

    return res.redirect(requiresSetup ? '/profile/edit/account' : '/signin');
  };
}

const requireMfaForAccountAccess = createMfaSessionMiddleware();

export default requireMfaForAccountAccess;
export { createMfaSessionMiddleware, requireMfaForAccountAccess };
