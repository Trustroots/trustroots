/**
 * Module dependencies.
 */
import errorService, {
  type ValidationFailure,
} from './../../../core/server/services/error.server.service.mts';
import log from '@trustroots/logger';
import mongoose, { type Types } from 'mongoose';
import { getClientIpAddress } from '../../../core/server/services/client-ip.server.service.mts';
import { hashIpAddress } from '../../../core/server/services/ip-hash.server.service.mts';

interface AuditLogRecord {
  body?: unknown;
  date?: Date;
  ipHash?: string;
  params?: unknown;
  query?: unknown;
  route?: string;
  user: Types.ObjectId | string;
}

interface UserRecord {
  _id: Types.ObjectId;
  username: string;
  displayName?: string;
  roles?: string[];
}

interface AuditRequest {
  query?: {
    username?: unknown;
    team?: unknown;
    action?: unknown;
    hideOwn?: unknown;
  };
  user?: { _id: Types.ObjectId | string };
}

interface AuditRecordRequest {
  body: unknown;
  get(name: string): string | null;
  ip: string;
  params: unknown;
  query: unknown;
  route: { path: string };
  user: { _id: Types.ObjectId | string };
}

interface AuditResponse {
  status(code: number): AuditResponse;
  send(body: unknown): unknown;
  json(body: unknown): unknown;
}

const AuditLog = mongoose.model<AuditLogRecord>('AuditLog');
const User = mongoose.model<UserRecord>('User');

/**
 * This middleware stores queries to audit log
 * @esmNamed
 */
export const record = (
  req: AuditRecordRequest,
  _res: unknown,
  next: (error?: Error | null) => void,
): void => {
  const omittedAddressFields = ['ip', 'ipAddress', 'ipHash'];
  const omitAddressFields = (value: unknown) =>
    Object.fromEntries(
      Object.entries(value ?? {}).filter(
        ([key]) => !omittedAddressFields.includes(key),
      ),
    );
  const auditLogItem = new AuditLog({
    body: omitAddressFields(req.body),
    ipHash: hashIpAddress(getClientIpAddress(req)),
    params: req.params,
    query: omitAddressFields(req.query),
    route: req.route.path,
    user: req.user._id,
  });

  // Save support request to db
  auditLogItem.save().then(
    () => next(),
    (error: Error) => {
      log('error', 'Failed storing audit log item to the DB. #fi2fb2', {
        error,
      });
      next();
    },
  );
};

/**
 * Return the latest matching entries, filtered by acting staff.
 * @esmNamed
 */
export const list = async (
  req: AuditRequest,
  res: AuditResponse,
): Promise<unknown> => {
  const { username, team, action, hideOwn } = req.query || {};
  if (
    (username !== undefined && typeof username !== 'string') ||
    (team !== undefined && typeof team !== 'string') ||
    (team && !['admin', 'welcome-team', 'support-team'].includes(team)) ||
    (action !== undefined &&
      action !== '' &&
      action !== 'shadowban' &&
      action !== 'suspend') ||
    (hideOwn !== undefined && hideOwn !== 'true' && hideOwn !== 'false')
  ) {
    return res.status(400).send({ message: 'Invalid audit log filters.' });
  }
  try {
    const criteria: Record<string, unknown> = {};
    const actorIds: { $in?: Types.ObjectId[]; $ne?: Types.ObjectId | string } =
      {};
    if (hideOwn === 'true' && req.user) actorIds.$ne = req.user._id;
    if (action) {
      criteria.route = '/api/admin/user/change-role';
      criteria['body.role'] = action === 'suspend' ? 'suspended' : 'shadowban';
      criteria.$or = [
        { 'body.action': 'add' },
        { 'body.action': { $exists: false } },
      ];
    }
    if (username || team) {
      const actorCriteria: Record<string, unknown> = {};
      // The username schema path lowercases and trims query values itself.
      if (username) actorCriteria.username = String(username);
      if (team) actorCriteria.roles = String(team);
      const actors = await User.find(actorCriteria)
        .select(
          // Stryker disable next-line StringLiteral: only the always-present _id of each actor is read
          '_id',
        )
        .lean();
      actorIds.$in = actors.map(actor => actor._id);
    }
    if (actorIds.$in || actorIds.$ne) criteria.user = actorIds;
    const items = await AuditLog.find(criteria)
      .select('-ip -body.ipAddress -query.ip -query.ipAddress')
      .sort({ date: -1, _id: -1 })
      .limit(100)
      .populate({
        path: 'user',
        select: 'username displayName roles',
      })
      .exec();
    return res.json(items || []);
  } catch (err: unknown) {
    return res.status(400).send({
      message: errorService.getErrorMessage(err as ValidationFailure),
    });
  }
};
/**
 * Existing actors from the whole history, independent of the current filters.
 * @esmNamed
 */
export const actors = async (
  _req: unknown,
  res: AuditResponse,
): Promise<unknown> => {
  try {
    const actorIds = await AuditLog.distinct('user');
    const users = await User.find({ _id: { $in: actorIds } })
      .select('_id username displayName roles')
      .sort({ username: 1 })
      .lean();
    return res.send(users);
  } catch (err: unknown) {
    return res.status(400).send({
      message: errorService.getErrorMessage(err as ValidationFailure),
    });
  }
};

export default {
  record,
  list,
  actors,
};
