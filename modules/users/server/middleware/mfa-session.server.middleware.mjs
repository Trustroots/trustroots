const allowedMfaPaths = new Set([
  '/api/auth/signin',
  '/api/auth/session',
  '/api/auth/signout',
  '/api/auth/mfa/verify',
  '/api/auth/passkeys/options',
  '/api/auth/passkeys/verify',
  '/api/users/mfa',
  '/api/users/mfa/enrol',
  '/api/users/mfa/enrol/verify',
  '/api/users/mfa/recovery-codes',
  '/api/users/mfa/disable',
]);

function createMfaSessionMiddleware() {
  return function requireMfaForAccountAccess(req, res, next) {
    if (
      req.user?.mfaEnabled !== true ||
      req.user.$locals?.mfaVerified === true
    ) {
      return next();
    }

    if (allowedMfaPaths.has(req.path)) return next();

    if (req.path.startsWith('/api/')) {
      return res.status(403).json({
        message: 'Verify authenticator MFA before continuing.',
        mfaRequired: true,
      });
    }

    return res.redirect('/signin');
  };
}

const requireMfaForAccountAccess = createMfaSessionMiddleware();

export default requireMfaForAccountAccess;
export { createMfaSessionMiddleware, requireMfaForAccountAccess };
