import mongoose, { type Types } from 'mongoose';
import crypto from 'node:crypto';
import config from '../../../../config/config.mts';
import { applyMailSafety } from '../../../../config/lib/mail-safety.mts';
import { setEmailConfirmationToken } from '../../../users/server/services/email-confirmation.server.service.mts';
import mail from '../../../core/server/services/email.server.service.mts';
import type {
  UserServerRecord,
  UserServerModel,
} from '../../../users/server/models/user.server.types.mts';
import type {
  RecoveryCandidate,
  RecoveryDay,
  RecoveryResult,
} from '../../shared/sparkpost.ts';
import {
  DiagnosticInputError,
  windowDates,
} from './sparkpost.server.service.mts';
const User = mongoose.model<UserServerRecord, UserServerModel>('User');
const Message = mongoose.model<{
  _id: Types.ObjectId;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  created: Date;
  content: string;
  read: boolean;
  shadowHidden: boolean;
}>('Message');
const excluded = ['suspended', 'shadowban'];

function dayRange(day: unknown) {
  if (
    typeof day !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(Date.parse(day)) ||
    new Date(day).toISOString().slice(0, 10) !== day ||
    Date.parse(day) > Date.now()
  )
    throw new DiagnosticInputError('Choose a valid past or current UTC day.');
  return { $gte: new Date(day), $lt: new Date(Date.parse(day) + 86400000) };
}
function allowed(user: UserServerRecord | null): user is UserServerRecord {
  return !!user && !user.roles.some(role => excluded.includes(role));
}

// Resolve IDs from the database again at send time; client fields never supply recipients or content.
async function resolve(key: string, date: unknown) {
  const range = dayRange(date);
  const [kind, id] = key.split(':');
  if (!['signup', 'message'].includes(kind) || !/^[a-f\d]{24}$/.test(id || ''))
    throw new DiagnosticInputError('Invalid recovery selection.');
  if (kind === 'signup') {
    const user = await User.findOne({
      _id: id,
      created: range,
      public: false,
      emailTemporary: { $type: 'string', $ne: '' },
    });
    if (!allowed(user)) return null;
    return { key, kind: 'signup' as const, user, sender: null, messages: [] };
  }
  const selected = await Message.findOne({
    _id: id,
    created: range,
    read: false,
    shadowHidden: { $ne: true },
  }).lean();
  if (!selected) return null;
  const [user, sender, messages, replied] = await Promise.all([
    User.findById(selected.userTo),
    User.findById(selected.userFrom),
    Message.find({
      userTo: selected.userTo,
      userFrom: selected.userFrom,
      read: false,
      shadowHidden: { $ne: true },
    })
      .sort({ created: -1, _id: -1 })
      .limit(51)
      .lean(),
    Message.exists({
      userTo: selected.userFrom,
      userFrom: selected.userTo,
      created: { $gte: selected.created },
    }),
  ]);
  if (
    !allowed(user) ||
    !allowed(sender) ||
    !user.public ||
    !sender.public ||
    replied ||
    !messages.length ||
    messages.length > 50 ||
    String(messages[0]._id) !== id ||
    user.blocked?.some(blocked => String(blocked) === String(sender._id)) ||
    sender.blocked?.some(blocked => String(blocked) === String(user._id)) ||
    new Date(messages[0].created).getTime() > Date.now() - 600000 ||
    new Date(messages[0].created).getTime() < Date.now() - 30 * 86400000
  )
    return null;
  return { key, kind: 'message' as const, user, sender, messages };
}

export async function recoveryDay(
  date: unknown,
  pageValue: unknown = '1',
): Promise<RecoveryDay> {
  const range = dayRange(date);
  const page = Number(pageValue);
  if (!Number.isInteger(page) || page < 1 || page > 1000)
    throw new DiagnosticInputError('Invalid recovery page.');
  // Stable pages over the combined application events; ineligible rows are filtered after retrieval.
  const rows = await mongoose.connection
    .collection('users')
    .aggregate<{ key: string; created: Date }>(
      [
        {
          $match: { created: range, public: false, roles: { $nin: excluded } },
        },
        {
          $project: {
            key: { $concat: ['signup:', { $toString: '$_id' }] },
            created: 1,
          },
        },
        {
          $unionWith: {
            coll: 'messages',
            pipeline: [
              {
                $match: {
                  created: range,
                  read: false,
                  shadowHidden: { $ne: true },
                },
              },
              { $sort: { created: -1, _id: -1 } },
              {
                $group: {
                  _id: { from: '$userFrom', to: '$userTo' },
                  id: { $first: '$_id' },
                  created: { $first: '$created' },
                },
              },
              {
                $project: {
                  key: { $concat: ['message:', { $toString: '$id' }] },
                  created: 1,
                },
              },
            ],
          },
        },
        { $sort: { created: 1, key: 1 } },
        { $skip: (page - 1) * 50 },
        { $limit: 51 },
      ],
      { maxTimeMS: 10000 },
    )
    .toArray();
  const candidates: RecoveryCandidate[] = [];
  for (const row of rows.slice(0, 50)) {
    const resolved = await resolve(row.key, date);
    if (!resolved) continue;
    const prior = await mongoose.connection
      .collection('emailRecovery')
      .findOne({ _id: row.key as never });
    candidates.push({
      key: row.key,
      kind: resolved.kind,
      recipient:
        resolved.kind === 'signup'
          ? resolved.user.emailTemporary!
          : resolved.user.email,
      username: resolved.user.username,
      description:
        resolved.kind === 'signup'
          ? 'Fresh sign-up confirmation'
          : `Unread-message reminder from @${resolved.sender!.username}`,
      ...(prior ? { status: String(prior.status) } : {}),
    });
  }
  return { candidates, more: rows.length > 50, page };
}

export async function queueRecovery(
  date: unknown,
  keys: unknown,
  actor: Types.ObjectId,
): Promise<RecoveryResult[]> {
  dayRange(date);
  if (
    !Array.isArray(keys) ||
    !keys.length ||
    keys.length > 50 ||
    keys.some(key => typeof key !== 'string') ||
    new Set(keys).size !== keys.length
  )
    throw new DiagnosticInputError(
      'Select between 1 and 50 distinct recovery emails.',
    );
  if (applyMailSafety(config) !== 'live' || config.mailer.options.jsonTransport)
    throw new DiagnosticInputError(
      'Recovery requires live production email sending.',
    );
  const results: RecoveryResult[] = [];
  for (const key of keys as string[]) {
    const item = await resolve(key, date);
    if (!item) {
      results.push({ key, status: 'No longer eligible' });
      continue;
    }
    const records = mongoose.connection.collection<{
      _id: string;
      actor: Types.ObjectId;
      status: string;
      created: Date;
    }>('emailRecovery');
    try {
      await records.insertOne({
        _id: key,
        actor,
        status: 'claiming',
        created: new Date(),
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      results.push({
        key,
        status: 'Already handled; inspect previous outcome',
      });
      continue;
    }
    try {
      // Record intent before queueing; uncertain outcomes retain their claim and are never automatically replayed.
      await new (mongoose.model('AuditLog'))({
        user: actor,
        route: 'sparkpost/recovery',
        body: { key, date },
        params: {},
        query: {},
      }).save();
      if (item.kind === 'signup') {
        setEmailConfirmationToken(
          item.user,
          crypto.randomBytes(32).toString('hex'),
        );
        await item.user.save();
        await new Promise<void>((resolve, reject) =>
          mail.sendSignupEmailConfirmation(item.user, error =>
            error ? reject(error) : resolve(),
          ),
        );
      } else {
        await new Promise<void>((resolve, reject) =>
          mail.sendMessagesUnread(
            item.sender!,
            item.user,
            {
              notificationCount: 1,
              messages: item.messages.map(message => ({
                content: String(message.content),
                created: message.created,
              })),
            },
            error => (error ? reject(error) : resolve()),
          ),
        );
      }
      await records.updateOne({ _id: key }, { $set: { status: 'queued' } });
      results.push({ key, status: 'Queued for delivery' });
    } catch {
      await records.updateOne({ _id: key }, { $set: { status: 'uncertain' } });
      results.push({
        key,
        status: 'Not confirmed queued; inspect before retrying',
      });
    }
  }
  return results;
}

export async function recoveryAccounts(
  from: unknown,
  to: unknown,
  pageValue: unknown = '1',
) {
  const range = windowDates(from, to);
  const page = Number(pageValue);
  if (!Number.isInteger(page) || page < 1 || page > 1000)
    throw new DiagnosticInputError('Invalid account page.');
  const users = await User.find({
    created: { $gte: range.from, $lt: range.to },
    public: false,
    roles: { $nin: excluded },
  })
    .sort({ created: 1, _id: 1 })
    .skip((page - 1) * 50)
    .limit(51)
    .exec();
  const candidates = [];
  for (const user of users.slice(0, 50)) {
    const key = 'signup:' + user._id;
    const prior = await mongoose.connection
      .collection<{ _id: string; status: string }>('emailRecovery')
      .findOne({ _id: key });
    candidates.push({
      key,
      kind: 'signup' as const,
      username: user.username,
      recipient: user.emailTemporary || user.email,
      description: 'Fresh sign-up confirmation',
      created: new Date(user.created!).toISOString(),
      ...(prior
        ? { status: prior.status }
        : !user.emailTemporary
          ? { status: 'No pending confirmation address' }
          : {}),
    });
  }
  return { candidates, more: users.length > 50, page };
}
