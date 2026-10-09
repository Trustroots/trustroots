import mongoose from 'mongoose';
import config from '../../../../config/config.mjs';

export const ADMIN_ELEVATION_REQUIRED = 'ADMIN_ELEVATION_REQUIRED';

export function elevationLifetimeMs() {
  return (
    config.adminElevation?.lifetimeMs ??
    // Default: half an hour of elevated admin access after password confirmation.
    30 * 60 * 1000
  );
}

export function isAdminElevated(session, now = Date.now()) {
  const elevatedAt = session?.adminElevatedAt;
  if (!Number.isFinite(elevatedAt)) {
    return false;
  }
  return elevatedAt + elevationLifetimeMs() > now;
}

export function requireAdminElevation(req, res, next) {
  res.set('Cache-Control', 'no-store');
  res.vary('Cookie');
  if (isAdminElevated(req.session)) {
    return next();
  }
  return res.status(403).json({
    code: ADMIN_ELEVATION_REQUIRED,
    message: 'Enter your password to continue with admin tools.',
  });
}

export async function confirmAdminPassword(req, res, next) {
  try {
    if (
      typeof req.body?.password !== 'string' ||
      !req.body.password ||
      req.body.password.length > 1024
    ) {
      return res.status(400).json({ message: 'Enter your current password.' });
    }
    const user = await mongoose.model('User').findById(req.user._id);
    if (!user || !(await user.authenticate(req.body.password))) {
      return res
        .status(400)
        .json({ message: 'Current password is incorrect.' });
    }
    if ((user.authVersion || 0) !== (req.user.authVersion || 0)) {
      return res.status(403).json({ message: 'Sign in again.' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

export function elevateAdminSession(req, res) {
  const now = Date.now();
  req.session.adminElevatedAt = now;
  return res.status(200).json({
    elevatedUntil: new Date(now + elevationLifetimeMs()).toISOString(),
  });
}
