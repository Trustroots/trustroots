import type { NextFunction } from 'express';
import mongoose from 'mongoose';
import type {
  UserServerModel,
  UserServerRecord,
} from '../models/user.server.types.mts';
import {
  type MemberBrowserRequest,
  type SessionMember,
  sessionId,
  sessionLifetimes,
} from '../services/member-session.server.service.mts';

interface SessionRequest extends MemberBrowserRequest {
  body?: { password?: unknown };
  params: Record<string, string>;
}

interface SessionResponse {
  set(name: string, value: string): unknown;
  vary(name: string): unknown;
  status(code: number): Pick<SessionResponse, 'json'>;
  json(body: unknown): unknown;
  sendStatus(code: number): unknown;
}

export function requireMember(
  req: { user?: SessionMember | null },
  res: SessionResponse,
  next: NextFunction,
) {
  res.set('Cache-Control', 'no-store');
  res.vary('Cookie');
  if (!req.user)
    return res
      .status(403)
      .json({ message: 'Sign in to manage your sessions.' });
  return next();
}
export async function list(
  req: MemberBrowserRequest,
  res: SessionResponse,
  next: NextFunction,
) {
  try {
    const now = new Date();
    const lifetimes = sessionLifetimes();
    const records = await mongoose
      .model('MemberSession')
      .find({
        user: req.user._id,
        authVersion: req.user.authVersion || 0,
        revoked: false,
        expiresAt: { $gt: now },
        lastSeenAt: { $gt: new Date(now.getTime() - lifetimes.idle) },
      })
      .sort({ createdAt: -1 })
      .limit(100);
    return res.json(
      records.map(record => ({
        id: record.id,
        createdAt: record.createdAt,
        lastSeenAt: record.lastSeenAt,
        current: record.id === sessionId(req.sessionID),
      })),
    );
  } catch (error) {
    return next(error);
  }
}
export async function confirmPassword(
  req: SessionRequest,
  res: SessionResponse,
  next: NextFunction,
) {
  try {
    if (
      typeof req.body?.password !== 'string' ||
      req.body.password.length > 1024
    )
      return res.status(400).json({ message: 'Enter your current password.' });
    const user = await mongoose
      .model<UserServerRecord, UserServerModel>('User')
      .findById(req.user._id);
    if (!user || !(await user.authenticate(req.body.password)))
      return res
        .status(400)
        .json({ message: 'Current password is incorrect.' });
    if ((user.authVersion || 0) !== (req.user.authVersion || 0))
      return res.status(403).json({ message: 'Sign in again.' });
    return next();
  } catch (error) {
    return next(error);
  }
}
export async function revoke(
  req: SessionRequest,
  res: SessionResponse,
  next: NextFunction,
) {
  try {
    const id = String(req.params.id);
    if (!/^[a-f0-9]{64}$/.test(id)) return res.sendStatus(404);
    const record = await mongoose
      .model('MemberSession')
      .findOneAndUpdate(
        { _id: id, user: req.user._id, revoked: false },
        { $set: { revoked: true } },
      );
    if (!record) return res.sendStatus(404);
    if (id === sessionId(req.sessionID))
      return req.session.destroy(error =>
        error ? next(error) : res.sendStatus(204),
      );
    return res.sendStatus(204);
  } catch (error) {
    return next(error);
  }
}
export async function revokeAll(
  req: MemberBrowserRequest,
  res: SessionResponse,
  next: NextFunction,
) {
  try {
    await mongoose
      .model('User')
      .updateOne({ _id: req.user._id }, { $inc: { authVersion: 1 } });
    await mongoose
      .model('MemberSession')
      .updateMany({ user: req.user._id }, { $set: { revoked: true } });
    return req.session.destroy(error =>
      error ? next(error) : res.sendStatus(204),
    );
  } catch (error) {
    return next(error);
  }
}
