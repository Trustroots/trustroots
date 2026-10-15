import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import limits from '../../../core/server/services/targeted-request-limits.server.service.mjs';
import { getClientIpAddress } from '../../../core/server/services/client-ip.server.service.mts';
import log from '../../../../config/lib/logger.mjs';

const User = mongoose.model('User');
const AuditLog = mongoose.model('AuditLog');
const startPath = '/api/auth/masquerade';
const stopPath = `${startPath}/stop`;
const sessionPath = '/api/auth/session';
const signoutPath = '/api/auth/signout';
const duration = 15 * 60 * 1000;

// Only reviewed reads: no token handlers, exports, push credentials or admin APIs.
const readPaths = [
  /^\/api\/(?:languages|volunteers|greeters|statistics|messages|messages-count|messages-sync|users|tribes|offers|experiences|my-experience)$/,
  /^\/api\/(?:users\/memberships|blocked-users|nostr\/author-visibility)$/,
  /^\/api\/users\/mini\/[a-f\d]{24}$/i,
  /^\/api\/users\/[A-Za-z\d._-]{3,34}$/,
  /^\/api\/messages\/[a-f\d]{24}$/i,
  /^\/api\/offers(?:-by)?\/[a-f\d]{24}$/i,
  /^\/api\/tribes\/[^/]+(?:\/members)?$/,
  /^\/api\/contact(?:-by)?\/[a-f\d]{24}$/i,
  /^\/api\/contacts\/[a-f\d]{24}(?:\/common)?$/i,
  /^\/api\/experiences\/(?:count|suggestion|[a-f\d]{24})$/i,
];
// Prevent broad username matching from admitting reserved API paths.
const excludedPaths = new Set([
  '/api/users/export',
  '/api/users/unified-push',
  '/api/users/password',
]);

function reject(res, code, message, status = 403) {
  return res.status(status).json({ code, message });
}

async function audit(req, action, outcome, extra = {}) {
  await AuditLog.create({
    user: req.actor._id,
    ip: getClientIpAddress(req),
    route: action,
    body: {
      target: req.session.masquerade.target,
      correlation: req.session.masquerade.correlation,
      outcome,
      ...extra,
    },
  });
}

function rotate(req, actor, masquerade) {
  return new Promise((resolve, rejectPromise) => {
    req.session.regenerate(error => {
      if (error) return rejectPromise(error);
      req.session.passport = {
        user: { id: actor.id, authVersion: actor.authVersion || 0 },
      };
      req.session.viewGeneration = randomUUID();
      if (masquerade) req.session.masquerade = masquerade;
      req.session.save(saveError =>
        saveError ? rejectPromise(saveError) : resolve(),
      );
    });
  });
}

async function middleware(req, res, next) {
  req.actor = req.user;
  const view = req.session.masquerade;
  req.memberView = Boolean(view);
  const generation = req.session.viewGeneration;
  // Express routes are case-insensitive by default, including static endpoints.
  const path = req.path.toLowerCase();
  const api = /^\/api(?:\/|$)/.test(path);
  const safeMethod = ['GET', 'HEAD'].includes(req.method);
  const sessionRead = path === sessionPath && safeMethod;
  const lifecycle =
    req.method === 'POST' && [stopPath, signoutPath].includes(path);
  const requestedGeneration =
    req.get('X-Trustroots-View') || (lifecycle && req.body?.viewGeneration);
  res.locals.viewContext = generation ? { generation } : null;

  if (
    (generation || requestedGeneration) &&
    (api || !safeMethod) &&
    !sessionRead &&
    requestedGeneration !== generation
  ) {
    return reject(
      res,
      'VIEW_CONTEXT_CHANGED',
      'Your account view has changed. Reload this page.',
      409,
    );
  }
  if (!view) {
    if (generation && sessionRead) {
      res.set('Cache-Control', 'no-store');
      res.vary('Cookie');
      return res.json({
        userId: req.user ? String(req.user._id) : null,
        viewGeneration: generation,
      });
    }
    return next();
  }

  res.set('Cache-Control', 'no-store');
  res.vary('Cookie');
  const actorValid = req.actor && req.actor.roles.includes('admin');
  const target = actorValid
    ? await User.findById(view.target).select('-salt -password')
    : null;
  const valid =
    actorValid &&
    target &&
    !target.roles.some(role => ['admin', 'suspended'].includes(role)) &&
    (target.authVersion || 0) === view.authVersion &&
    Date.now() < view.expiresAt;
  res.locals.viewContext = {
    generation,
    username: view.username,
    expiresAt: view.expiresAt,
    expired: !valid,
  };
  // Expired views remain recoverable, without exposing either account's data.
  req.user = valid ? target : undefined;
  if (lifecycle) {
    if (path === signoutPath && req.actor) {
      try {
        await audit(req, 'masquerade:end', 'signed-out');
      } catch (error) {
        log('error', 'Could not record the end of a member view.', { error });
      }
    }
    return next();
  }
  if (sessionRead) {
    return res.json({
      userId: req.user ? String(req.user._id) : null,
      viewGeneration: generation,
    });
  }
  if (!valid) {
    if (req.actor) {
      try {
        await audit(req, 'masquerade:end', 'expired');
      } catch (error) {
        log('error', 'Could not record the end of a member view.', { error });
      }
    }
    if (!api && safeMethod) return next();
    return reject(
      res,
      'VIEW_EXPIRED',
      'This member view has ended. Return to your account.',
      409,
    );
  }
  if (
    !safeMethod ||
    (api &&
      (excludedPaths.has(path) ||
        !readPaths.some(pattern => pattern.test(path))))
  ) {
    return reject(
      res,
      'VIEW_READ_ONLY',
      'This member view is read-only. Return to your account to make changes.',
    );
  }
  // Fail closed before returning private data; record authorisation, not content.
  await audit(
    req,
    api ? 'masquerade:read' : 'masquerade:document',
    'authorised',
    { path: req.path },
  );
  return next();
}

async function start(req, res) {
  if (!req.actor || !req.actor.roles.includes('admin')) {
    return reject(res, 'VIEW_FORBIDDEN', 'Administrator access is required.');
  }
  if (req.session.masquerade)
    return reject(res, 'VIEW_NESTED', 'Leave the current member view first.');
  const { targetId, password, reason } = req.body || {};
  if (
    !mongoose.isValidObjectId(targetId) ||
    typeof password !== 'string' ||
    password.length > 1024 ||
    typeof reason !== 'string' ||
    !reason.trim() ||
    reason.length > 500
  ) {
    return reject(
      res,
      'VIEW_INVALID',
      'Supply a member, your password and a reason (up to 500 characters).',
      400,
    );
  }
  const limit = await limits.consume({
    operation: 'masquerade',
    windowMs: duration,
    dimensions: [{ name: 'actor', value: req.actor.id, limit: 5 }],
  });
  if (!limit.allowed) {
    res.set('Retry-After', String(limit.retryAfterSeconds));
    return reject(
      res,
      'VIEW_LIMIT',
      'Too many attempts. Please try again later.',
      429,
    );
  }
  const actor = await User.findById(req.actor._id);
  if (
    !actor ||
    !actor.roles.includes('admin') ||
    (actor.authVersion || 0) !== (req.actor.authVersion || 0) ||
    !(await actor.authenticate(password))
  ) {
    return reject(
      res,
      'VIEW_PASSWORD',
      'Your password could not be confirmed.',
    );
  }
  const target = await User.findById(targetId).select(
    'username roles authVersion',
  );
  if (
    !target ||
    target.id === actor.id ||
    target.roles.some(role => ['admin', 'suspended'].includes(role))
  ) {
    return reject(
      res,
      'VIEW_TARGET',
      'Choose an active member who is not an administrator.',
      400,
    );
  }
  const view = {
    target: target.id,
    username: target.username,
    authVersion: target.authVersion || 0,
    expiresAt: Date.now() + duration,
    correlation: randomUUID(),
  };
  // Persist entry before establishing access. Never store the supplied password.
  req.session.masquerade = view;
  try {
    await audit(req, 'masquerade:start', 'authorised', {
      reason: reason.trim(),
    });
  } finally {
    delete req.session.masquerade;
  }
  await rotate(req, actor, view);
  res.json({ redirect: `/profile/${target.username}` });
}

async function stop(req, res) {
  if (!req.actor || !req.actor.roles.includes('admin')) {
    return reject(
      res,
      'VIEW_FORBIDDEN',
      'Sign in again to return to your account.',
      401,
    );
  }
  if (!req.session.masquerade)
    return reject(res, 'VIEW_MISSING', 'There is no member view to end.', 400);
  const username = req.session.masquerade.username;
  try {
    await audit(req, 'masquerade:end', 'returned');
  } catch (error) {
    log('error', 'Could not record the end of a member view.', { error });
  }
  await rotate(req, req.actor);
  res.json({ redirect: `/admin/user/${username}` });
}

function register(app) {
  app.use(middleware);
  app.post(startPath, start);
  app.post(stopPath, stop);
}

const service = { register, middleware, start, stop };
export default service;
export { service as 'module.exports' };
