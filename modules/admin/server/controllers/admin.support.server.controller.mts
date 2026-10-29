import mongoose, {
  type PipelineStage,
  type QueryFilter,
  type Types,
} from 'mongoose';
import { SUPPORT_CATEGORIES } from '../../../support/shared/categories.ts';
import {
  SUPPORT_STATUSES,
  UNRESOLVED_STATUSES,
  isSupportStatus,
  normaliseSupportStatus,
  type SupportStatus,
} from '../../../support/shared/statuses.ts';
import type { SupportMessageRecord } from '../../../support/server/models/support-message.server.model.mts';
import { normaliseStoredSupportCategory } from '../../../support/server/services/support-fingerprint.server.service.mts';
import { supportCategoryExpression } from '../../../support/server/services/support-migration.server.service.mts';
import {
  queueReply,
  retryReply,
} from '../../../support/server/services/support-email.server.service.mts';

interface SupportRequestRecord {
  _id: Types.ObjectId;
  category: string;
  user?: Types.ObjectId;
  reportedUser?: Types.ObjectId;
  sent?: Date;
  email?: string;
  username?: string;
  reportMember?: string;
  message?: string;
  status?: string;
  statusProvenance?: 'explicit' | 'missing';
  resolvedAt?: Date | null;
  resolvedBy?: Types.ObjectId | string | null;
  subject?: string;
  lastActivityAt?: Date;
  statusChangedAt?: Date;
  statusRevision?: number;
  zendeskTicketId?: number;
  initialAttachments?: SupportMessageRecord['attachments'];
  oversized?: boolean;
  truncated?: boolean;
}

interface UserRecord {
  _id: Types.ObjectId;
  username: string;
  displayName?: string;
  email: string;
  emailTemporary?: string;
  public?: boolean;
  roles?: string[];
  created?: Date;
  description?: string;
  tagline?: string;
  locationLiving?: string;
  locationFrom?: string;
  languages?: string[];
  removeProfileToken?: string;
  firstName?: string;
  lastName?: string;
  score?: number;
}

interface AuditLogRecord {
  user: Types.ObjectId | string;
  route: string;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
}

interface InvestigationRecord {
  _id: Types.ObjectId;
  created: Date;
  content?: string;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  shadowHidden?: boolean;
  public?: boolean;
  recommend?: string;
  interactions?: Record<string, boolean>;
  feedbackPublic?: string;
}

type SupportQuery = Record<string, unknown>;
type SupportParams = Record<string, string>;
interface SupportRequest {
  params: SupportParams;
  query: SupportQuery;
  body: {
    status?: unknown;
    body?: unknown;
    idempotencyKey?: unknown;
    confirmUncertain?: unknown;
  };
  route: { path: string };
  user: {
    _id: Types.ObjectId | string;
    username?: string;
    displayName?: string;
  };
}

interface SupportResponse {
  status(code: number): SupportResponse;
  send(body: unknown): unknown;
}

type Action = (req: SupportRequest, res: SupportResponse) => Promise<unknown>;
type SupportError = Error & { status: number };
const LIST_STATUSES = [
  'all',
  'unresolved',
  'unconfirmed',
  'resolved',
  ...SUPPORT_STATUSES,
] as const;

function isOneOf<const Values extends readonly unknown[]>(
  values: Values,
  value: unknown,
): value is Values[number] {
  return values.includes(value);
}

const SupportRequestModel =
  mongoose.model<SupportRequestRecord>('SupportRequest');
const SupportMessage = mongoose.model<SupportMessageRecord>('SupportMessage');
const User = mongoose.model<UserRecord>('User');
const Message = mongoose.model<InvestigationRecord>('Message');
const Experience = mongoose.model<InvestigationRecord>('Experience');
const AuditLog = mongoose.model<AuditLogRecord>('AuditLog');
const PAGE_SIZE = 50;
const LIST_FIELDS =
  '_id category user reportedUser sent email username reportMember status resolvedAt resolvedBy subject lastActivityAt zendeskTicketId';
const REQUEST_FIELDS = `${LIST_FIELDS} message statusChangedAt statusRevision initialAttachments oversized truncated`;
const CONVERSATION_FIELDS =
  '_id request direction kind body createdAt authorId authorName deliveryState attachments oversized truncated';
const MEMBER_FIELDS =
  '_id username displayName email emailTemporary public roles created description tagline locationLiving locationFrom languages removeProfileToken';

function invalid(message: string): SupportError {
  return Object.assign(new Error(message), { status: 400 });
}

function pageNumber(query: SupportQuery): number {
  const value = query.page === undefined ? '1' : query.page;
  // The shared pagination middleware normalises HTTP query values to numbers.
  if (
    !['number', 'string'].includes(typeof value) ||
    !/^[1-9]\d{0,5}$/.test(String(value))
  ) {
    throw invalid('Invalid page.');
  }
  return Number(value);
}

function objectId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) {
    throw invalid('Invalid ID.');
  }
  return value;
}

function errorResponse(error: unknown): {
  status: number;
  message: unknown;
} {
  const legacyError = error as { status?: number; message?: unknown };
  const status = legacyError.status;
  if (status) {
    return {
      status,
      message: legacyError.message,
    };
  }
  return {
    status: 500,
    message: 'Unable to load support information.',
  };
}

function handler(action: Action) {
  return async (
    req: SupportRequest,
    res: SupportResponse,
  ): Promise<unknown> => {
    try {
      return await action(req, res);
    } catch (error) {
      const response = errorResponse(error);
      return res.status(response.status).send({
        message: response.message,
      });
    }
  };
}

async function audit(req: SupportRequest): Promise<void> {
  // Never log report text, note text or private messages. Fail closed on storage errors.
  await new AuditLog({
    user: req.user._id,
    route: req.route.path,
    params: req.params,
    query: {
      ...Object.fromEntries(
        ['status', 'category', 'page']
          .filter(key => req.query[key] !== undefined)
          .map(key => [key, req.query[key]]),
      ),
      ...(req.query.q ? { hasSearch: true } : {}),
    },
    body: req.body?.status ? { status: req.body.status } : {},
  }).save();
}

async function requestById(req: SupportRequest) {
  const report = await SupportRequestModel.findById(
    objectId(req.params.requestId),
  )
    .select(REQUEST_FIELDS)
    .lean();
  if (!report) {
    throw Object.assign(new Error('Support request not found.'), {
      status: 404,
    });
  }
  return {
    ...report,
    category:
      normaliseStoredSupportCategory(report.category, report.reportMember) ||
      'other',
  };
}

function memberPayload(member: UserRecord): UserRecord & {
  pendingDeletion: boolean;
} {
  const { removeProfileToken, ...safe } = member;
  delete safe.score;
  return { ...safe, pendingDeletion: Boolean(removeProfileToken) };
}

export const list = handler(async (req, res) => {
  const page = pageNumber(req.query);
  const { category, status = 'unresolved', q } = req.query;
  if (
    !isOneOf(LIST_STATUSES, status) ||
    (category !== undefined &&
      (typeof category !== 'string' ||
        !Object.hasOwn(SUPPORT_CATEGORIES, category))) ||
    (q !== undefined && (typeof q !== 'string' || q.length > 200))
  ) {
    throw invalid('Invalid support filters.');
  }
  const pipeline: PipelineStage[] = [];
  pipeline.push({ $set: { category: supportCategoryExpression } });
  if (category) pipeline.push({ $match: { category } });
  const search = typeof q === 'string' ? q.trim() : '';
  if (search) {
    const expression = {
      $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      $options: 'i',
    };
    pipeline.push(
      {
        $lookup: {
          from: SupportMessage.collection.name,
          let: { requestId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$request', '$$requestId'] },
                body: expression,
              },
            },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: 'matchingReplies',
        },
      },
      {
        $match: {
          $or: [
            ...['subject', 'message', 'username', 'email'].map(field => ({
              [field]: expression,
            })),
            { 'matchingReplies.0': { $exists: true } },
            ...(/^[a-f\d]{24}$/i.test(search)
              ? [{ _id: new mongoose.Types.ObjectId(search) }]
              : []),
            ...(/^\d+$/.test(search) && Number.isSafeInteger(Number(search))
              ? [{ zendeskTicketId: Number(search) }]
              : []),
          ],
        },
      },
    );
  }
  pipeline.push({
    $set: {
      statusProvenance: {
        $cond: [
          { $in: [{ $type: '$status' }, ['missing', 'null']] },
          'missing',
          'explicit',
        ],
      },
      canonicalStatus: {
        $switch: {
          branches: [
            { case: { $eq: ['$status', 'resolved'] }, then: 'solved' },
            {
              case: { $in: ['$status', [...SUPPORT_STATUSES]] },
              then: '$status',
            },
          ],
          default: 'open',
        },
      },
      activity: { $ifNull: ['$lastActivityAt', '$sent'] },
    },
  });
  const matchStatus: Record<string, unknown> =
    status === 'all'
      ? {}
      : {
          canonicalStatus:
            status === 'unresolved'
              ? { $in: [...UNRESOLVED_STATUSES] }
              : status === 'unconfirmed'
                ? undefined
                : normaliseSupportStatus(status),
        };
  if (status === 'unconfirmed') {
    delete matchStatus.canonicalStatus;
    matchStatus.statusProvenance = 'missing';
  }
  if (status === 'open') matchStatus.statusProvenance = 'explicit';
  pipeline.push({
    $facet: {
      statusCounts: [
        { $match: { statusProvenance: 'explicit' } },
        { $group: { _id: '$canonicalStatus', count: { $sum: 1 } } },
      ],
      unconfirmedCount: [
        { $match: { statusProvenance: 'missing' } },
        { $count: 'count' },
      ],
      matching: [{ $match: matchStatus }, { $count: 'count' }],
      items: [
        { $match: matchStatus },
        { $sort: { activity: -1, _id: -1 } },
        { $skip: (page - 1) * PAGE_SIZE },
        { $limit: PAGE_SIZE },
        {
          $project: {
            ...Object.fromEntries(
              LIST_FIELDS.split(' ').map(field => [field, 1]),
            ),
            status: '$canonicalStatus',
            statusProvenance: 1,
          },
        },
      ],
    },
  });
  const [results, total] = await Promise.all([
    SupportRequestModel.aggregate<{
      items: SupportRequestRecord[];
      matching: Array<{ count: number }>;
      statusCounts: Array<{ _id: SupportStatus; count: number }>;
      unconfirmedCount: Array<{ count: number }>;
    }>(pipeline).option({ maxTimeMS: 10_000 }),
    SupportRequestModel.countDocuments({}),
  ]);
  const result = results[0];
  const matchingTotal = result.matching[0]?.count || 0;
  const statusCounts = Object.fromEntries(
    SUPPORT_STATUSES.map(value => [value, 0]),
  );
  result.statusCounts.forEach(item => {
    statusCounts[item._id] = item.count;
  });
  await audit(req);
  return res.send({
    items: result.items,
    page,
    hasMore: page * PAGE_SIZE < matchingTotal,
    total,
    matchingTotal,
    statusCounts,
    unconfirmedCount: result.unconfirmedCount[0]?.count || 0,
  });
});

export const detail = handler(async (req, res) => {
  const report = await requestById(req);
  await audit(req);
  return res.send({
    ...report,
    status: normaliseSupportStatus(report.status),
    statusProvenance:
      report.status === undefined || report.status === null
        ? 'missing'
        : 'explicit',
  });
});

export const setStatus = handler(async (req, res) => {
  const value = req.body?.status;
  if (!isSupportStatus(value) && value !== 'resolved') {
    throw invalid('Invalid status.');
  }
  const status = normaliseSupportStatus(value);
  const report = await requestById(req);
  await audit(req);
  const result = await SupportRequestModel.updateOne(
    { _id: report._id, ...revisionCriteria(report.statusRevision) },
    {
      $set: {
        status,
        resolvedAt:
          status === 'solved' || status === 'closed' ? new Date() : null,
        resolvedBy:
          status === 'solved' || status === 'closed' ? req.user._id : null,
        statusChangedAt: new Date(),
      },
      $inc: { statusRevision: 1 },
    },
  );
  if (!result.matchedCount)
    throw Object.assign(
      new Error('This request changed. Reload before updating it.'),
      { status: 409 },
    );
  return res.send({ status });
});

function revisionCriteria(
  revision?: number,
): QueryFilter<SupportRequestRecord> {
  return revision === undefined
    ? { statusRevision: { $exists: false } }
    : { statusRevision: revision };
}

export const conversation = handler(async (req, res) => {
  const report = await requestById(req);
  const page = pageNumber(req.query);
  const offset = (page - 1) * PAGE_SIZE;
  const [messages, count] = await Promise.all([
    SupportMessage.find({ request: report._id })
      .select(CONVERSATION_FIELDS)
      .sort({ createdAt: 1, _id: 1 })
      .skip(Math.max(0, offset - 1))
      .limit(PAGE_SIZE - (offset === 0 ? 1 : 0))
      .lean(),
    SupportMessage.countDocuments({ request: report._id }),
  ]);
  await audit(req);
  return res.send({
    items: [
      ...(offset === 0
        ? [
            {
              _id: `initial-${report._id}`,
              request: report._id,
              kind: 'initial',
              direction: 'inbound',
              body: report.message,
              createdAt: report.sent,
              authorName: report.username || report.email,
              deliveryState: 'received',
              attachments: report.initialAttachments || [],
              oversized: Boolean(report.oversized),
              truncated: Boolean(report.truncated),
            },
          ]
        : []),
      ...messages,
    ],
    page,
    hasMore: page * PAGE_SIZE < count + 1,
  });
});

export const reply = handler(async (req, res) => {
  const report = await requestById(req);
  await audit(req);
  const message = await queueReply(
    report._id.toString(),
    req.user,
    req.body?.body,
    req.body?.idempotencyKey,
  );
  const safe = await SupportMessage.findById(message._id)
    .select(CONVERSATION_FIELDS)
    .lean();
  return res.status(201).send(safe);
});

export const retry = handler(async (req, res) => {
  const report = await requestById(req);
  const messageId = objectId(req.params.messageId);
  await audit(req);
  const message = await retryReply(
    report._id.toString(),
    messageId,
    req.user,
    req.body?.idempotencyKey,
    req.body?.confirmUncertain,
  );
  const safe = await SupportMessage.findById(message._id)
    .select(CONVERSATION_FIELDS)
    .lean();
  return res.send(safe);
});

export const investigation = handler(async (req, res) => {
  const page = pageNumber(req.query);
  const report = await requestById(req);
  if (
    report.category !== 'reportMember' ||
    !report.user ||
    !report.reportedUser ||
    report.user.toString() === report.reportedUser.toString()
  ) {
    throw Object.assign(new Error('This report has no verified member pair.'), {
      status: 403,
    });
  }
  const { kind } = req.params;
  if (!isOneOf(['messages', 'experiences'] as const, kind)) {
    throw invalid('Invalid investigation type.');
  }
  const criteria: QueryFilter<InvestigationRecord> = {
    $or: [
      { userFrom: report.user, userTo: report.reportedUser },
      { userFrom: report.reportedUser, userTo: report.user },
    ],
  };
  const Model = kind === 'messages' ? Message : Experience;
  const fields =
    kind === 'messages'
      ? '_id created content userFrom userTo shadowHidden'
      : '_id created userFrom userTo public recommend interactions feedbackPublic';
  const items = await Model.find(criteria)
    .select(fields)
    .sort({ created: 1, _id: 1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE + 1)
    .populate('userFrom userTo', 'username displayName')
    .lean();
  await audit(req);
  return res.send({
    items: items.slice(0, PAGE_SIZE),
    page,
    hasMore: items.length > PAGE_SIZE,
  });
});

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findMembers(search: string) {
  const trimmed = search.trim();
  const lowered = trimmed.toLowerCase();
  const escaped = escapeRegex(lowered);
  // Usernames and emails are stored in lowercase, so these clauses can use
  // their indexes. A fresh expression is required for each field.
  const indexed: UserRecord[] = await User.find({
    $or: [
      { username: lowered },
      { email: lowered },
      { emailTemporary: lowered },
      { username: new RegExp(`^${escaped}`) },
      { email: new RegExp(`^${escaped}`) },
      { emailTemporary: new RegExp(`^${escaped}`) },
    ],
  })
    .select(MEMBER_FIELDS)
    .sort({ username: 1 })
    .limit(PAGE_SIZE)
    .lean();

  const seen = new Set(indexed.map(member => String(member._id)));
  if (seen.size >= PAGE_SIZE) return indexed;

  const namePattern = new RegExp(
    trimmed
      .split(/\s+/)
      .map(part => escapeRegex(part))
      .join('\\s*'),
    'i',
  );
  let named: UserRecord[] = [];
  try {
    named = await User.find({ $text: { $search: trimmed } })
      .select({ score: { $meta: 'textScore' } })
      .select(MEMBER_FIELDS)
      .sort({ score: { $meta: 'textScore' } })
      .limit(PAGE_SIZE)
      .lean();
  } catch {
    named = await User.find({
      $or: [
        { displayName: namePattern },
        { firstName: namePattern },
        { lastName: namePattern },
      ],
    })
      .select(MEMBER_FIELDS)
      .sort({ username: 1 })
      .limit(PAGE_SIZE)
      .maxTimeMS(2000)
      .lean();
  }

  return indexed
    .concat(named.filter(member => !seen.has(String(member._id))))
    .slice(0, PAGE_SIZE);
}

export const searchMembers = handler(async (req, res) => {
  const { search } = req.query;
  if (
    typeof search !== 'string' ||
    search.trim().length < 3 ||
    search.length > 254
  ) {
    throw invalid('Enter at least three characters.');
  }
  const members = await findMembers(search);
  await audit(req);
  return res.send(members.map(memberPayload));
});

export const member = handler(async (req, res) => {
  const identifier = req.params.memberId;
  const result =
    (await User.findOne({ username: identifier })
      .select(MEMBER_FIELDS)
      .lean()) ||
    (/^[a-f\d]{24}$/i.test(identifier)
      ? await User.findById(objectId(identifier)).select(MEMBER_FIELDS).lean()
      : null);
  if (!result) {
    throw Object.assign(new Error('Member not found.'), { status: 404 });
  }
  await audit(req);
  return res.send(memberPayload(result));
});

const api = {
  list,
  detail,
  setStatus,
  conversation,
  reply,
  retry,
  investigation,
  searchMembers,
  member,
};
export default api;
export { api as 'module.exports' };
