import crypto from 'node:crypto';
import type { NextFunction } from 'express';
import mongoose from 'mongoose';
import config from '../../../../config/config.mts';
import { recordActivity } from './account-activity.server.service.mts';

export interface SessionMember {
  _id: mongoose.Types.ObjectId;
  authVersion?: number;
}

interface MemberBrowserSession {
  memberSessionCreatedAt?: number;
  memberActivityEventId?: string;
  passport?: { user?: { authenticatedAt?: number } };
  destroy(callback: (error?: Error) => unknown): void;
}

export interface MemberBrowserRequest {
  user: SessionMember;
  sessionID: string;
  session: MemberBrowserSession;
}

export function sessionId(id: string) {
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update('member-session:' + id)
    .digest('hex');
}
export function sessionLifetimes() {
  // Every signed-in member keeps the same idle and absolute lifetimes.
  // Privileged admin tooling uses a separate password step-up instead of a
  // shorter session.
  return { idle: 7 * 86400000, absolute: 28 * 86400000 };
}

export async function checkMemberSession(
  req: MemberBrowserRequest | { user?: undefined },
  _res: unknown,
  next: NextFunction,
) {
  if (!req.user) return next();
  try {
    const now = Date.now();
    const lifetimes = sessionLifetimes();
    const createdAt =
      req.session.memberSessionCreatedAt ??
      req.session.passport?.user?.authenticatedAt ??
      now;
    req.session.memberSessionCreatedAt = createdAt;
    const expiresAt = new Date(createdAt + lifetimes.absolute);
    const Session = mongoose.model('MemberSession');
    const id = sessionId(req.sessionID);
    // Insert once. Revoked records remain as tombstones until absolute expiry.
    try {
      const result = await Session.updateOne(
        { _id: id },
        {
          $setOnInsert: {
            user: req.user._id,
            authVersion: req.user.authVersion || 0,
            createdAt: new Date(createdAt),
            lastSeenAt: new Date(createdAt),
            expiresAt,
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount === 1 && !req.session.memberActivityEventId) {
        req.session.memberActivityEventId = crypto.randomUUID();
      }
      if (req.session.memberActivityEventId) {
        const recorded = await recordActivity({
          userId: req.user._id,
          eventType: 'session_created',
          eventId: req.session.memberActivityEventId,
        });
        if (recorded) delete req.session.memberActivityEventId;
      }
    } catch (error) {
      // Simultaneous first requests can race to create the same session record.
      if ((error as { code?: number }).code !== 11000) throw error;
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
        (req as Partial<MemberBrowserRequest>).user = undefined;
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
          (req as Partial<MemberBrowserRequest>).user = undefined;
          return next();
        });
      }
    }
    return next();
  } catch (error) {
    return next(error);
  }
}
