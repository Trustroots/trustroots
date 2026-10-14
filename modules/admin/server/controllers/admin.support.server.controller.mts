import mongoose, { type FilterQuery, type Types } from 'mongoose';
import { SUPPORT_CATEGORIES } from '../../../support/shared/categories.ts';

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
  resolvedAt?: Date | null;
  resolvedBy?: Types.ObjectId | string | null;
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
  body: { status?: unknown };
  route: { path: string };
  user: { _id: Types.ObjectId | string };
}

interface SupportResponse {
  status(code: number): SupportResponse;
  send(body: unknown): unknown;
}

type Action = (req: SupportRequest, res: SupportResponse) => Promise<unknown>;
type SupportError = Error & { status: number };
const LIST_STATUSES = ['all', 'open', 'resolved'] as const;
const WRITE_STATUSES = ['open', 'resolved'] as const;

function isOneOf<const Values extends readonly unknown[]>(
  values: Values,
  value: unknown,
): value is Values[number] {
  return values.includes(value);
}

const SupportRequestModel =
  mongoose.model<SupportRequestRecord>('SupportRequest');
const User = mongoose.model<UserRecord>('User');
const Message = mongoose.model<InvestigationRecord>('Message');
const Experience = mongoose.model<InvestigationRecord>('Experience');
const AuditLog = mongoose.model<AuditLogRecord>('AuditLog');
const PAGE_SIZE = 50;
const LIST_FIELDS =
  '_id category user reportedUser sent email username reportMember status resolvedAt resolvedBy';
const REQUEST_FIELDS = `${LIST_FIELDS} message`;
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

function errorMessage(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error;
    return typeof message === 'string' ? message : undefined;
  }
  return undefined;
}

function errorResponse(error: unknown): {
  status: number;
  message: string | undefined;
} {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const { status } = error;
    if (status) {
      return {
        status: typeof status === 'number' ? status : 500,
        message: errorMessage(error),
      };
    }
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
    query: req.query,
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
  return report;
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
  const { category, status = 'open' } = req.query;
  if (
    !isOneOf(LIST_STATUSES, status) ||
    (category !== undefined &&
      (typeof category !== 'string' ||
        !Object.hasOwn(SUPPORT_CATEGORIES, category)))
  ) {
    throw invalid('Invalid support filters.');
  }
  const criteria: FilterQuery<SupportRequestRecord> = category
    ? { category: String(category) }
    : {};
  if (status === 'open') {
    criteria.$or = [{ status: 'open' }, { status: { $exists: false } }];
  }
  if (status === 'resolved') criteria.status = 'resolved';
  const items = await SupportRequestModel.find(criteria)
    .select(LIST_FIELDS)
    .sort({ sent: -1, _id: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE + 1)
    .lean();
  await audit(req);
  return res.send({
    items: items.slice(0, PAGE_SIZE),
    page,
    hasMore: items.length > PAGE_SIZE,
  });
});

export const detail = handler(async (req, res) => {
  const report = await requestById(req);
  await audit(req);
  return res.send(report);
});

export const setStatus = handler(async (req, res) => {
  const status = req.body.status;
  if (!isOneOf(WRITE_STATUSES, status)) {
    throw invalid('Invalid status.');
  }
  const report = await requestById(req);
  await audit(req);
  await SupportRequestModel.updateOne(
    { _id: report._id },
    {
      $set: {
        status,
        resolvedAt: status === 'resolved' ? new Date() : null,
        resolvedBy: status === 'resolved' ? req.user._id : null,
      },
    },
  );
  return res.send({ status });
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
  const criteria: FilterQuery<InvestigationRecord> = {
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
  const indexed = await User.find({
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
    named = await User.find(
      { $text: { $search: trimmed } },
      { score: { $meta: 'textScore' } },
    )
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
  const result = await User.findById(objectId(req.params.memberId))
    .select(MEMBER_FIELDS)
    .lean();
  if (!result) {
    throw Object.assign(new Error('Member not found.'), { status: 404 });
  }
  await audit(req);
  return res.send(memberPayload(result));
});

const api = { list, detail, setStatus, investigation, searchMembers, member };
export default api;
export { api as 'module.exports' };
