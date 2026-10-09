import crypto from 'node:crypto';
import mongoose from 'mongoose';
import config from '../../../../config/config.mjs';

export function sessionId(id) {
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update('member-session:' + id)
    .digest('hex');
}
export function sessionLifetimes(_user) {
  // Every signed-in member keeps the same idle and absolute lifetimes.
  // Privileged admin tooling uses a separate password step-up instead of a
  // shorter session.
  return { idle: 7 * 86400000, absolute: 28 * 86400000 };
}

export async function checkMemberSession(req, res, next) {
  if (!req.user) return next();
  try {
    const now = Date.now();
    const lifetimes = sessionLifetimes(req.user);
    const createdAt = req.session.memberSessionCreatedAt || now;
    req.session.memberSessionCreatedAt = createdAt;
    const expiresAt = new Date(createdAt + lifetimes.absolute);
    const Session = mongoose.model('MemberSession');
    const id = sessionId(req.sessionID);
    // Insert once. Revoked records remain as tombstones until absolute expiry.
    try {
      await Session.updateOne(
        { _id: id },
        {
          $setOnInsert: {
            user: req.user._id,
            authVersion: req.user.authVersion || 0,
            createdAt: new Date(createdAt),
            lastSeenAt: new Date(now),
            expiresAt,
          },
        },
        { upsert: true },
      );
    } catch (error) {
      // Simultaneous first requests can race to create the same session record.
      if (error.code !== 11000) throw error;
    }
    const record = await Session.findById(id);
    if (!record) return next(new Error('Member session record disappeared.'));
    if (
      String(record.user) !== String(req.user._id) ||
      record.authVersion !== (req.user.authVersion || 0) ||
      record.revoked ||
      expiresAt.getTime() <= now ||
      record.lastSeenAt.getTime() + lifetimes.idle <= now
    ) {
      return req.session.destroy(error => {
        if (error) return next(error);
        req.user = undefined;
        return next();
      });
    }
    if (record.lastSeenAt.getTime() + 60000 <= now) {
      const updated = await Session.findOneAndUpdate(
        {
          _id: id,
          user: req.user._id,
          authVersion: req.user.authVersion || 0,
          revoked: false,
          expiresAt: { $gt: new Date(now) },
        },
        { $set: { lastSeenAt: new Date(now) } },
        { new: true },
      );
      // A concurrent revocation must take effect for this request as well.
      if (!updated) {
        return req.session.destroy(error => {
          if (error) return next(error);
          req.user = undefined;
          return next();
        });
      }
    }
    return next();
  } catch (error) {
    return next(error);
  }
}
