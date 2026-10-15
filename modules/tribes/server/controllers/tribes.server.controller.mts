import errorService from '../../../core/server/services/error.server.service.mjs';
import paginationService from '../../../core/server/services/pagination.server.service.mjs';
import mongoose, { type Types } from 'mongoose';
import moment from 'moment';
import userMiniService from '../../../users/server/services/user-mini.server.service.mjs';
import userRolesService from '../../../users/server/services/user-roles.server.service.mjs';

interface TribeRecord {
  _id?: Types.ObjectId;
  slug?: string;
  label?: string;
  count?: number;
  public?: boolean;
}
interface UserRecord {
  _id?: Types.ObjectId;
  blocked?: Types.ObjectId[];
  public?: boolean;
  roles?: string[];
  member?: Array<{ tribe: Types.ObjectId }>;
  seen?: Date;
}

interface ContactRecord {
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  confirmed: boolean;
}

interface ExperienceRecord {
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  public: boolean;
  recommend: string;
  created?: Date;
}

interface MemberView {
  _id: Types.ObjectId;
  username?: string;
  displayName?: string;
}

interface MemberListResponse {
  contacts: MemberView[];
  recommenders: MemberView[];
  active: MemberView[];
}

interface RequestQuery {
  sortBy?: unknown;
  page?: string | number;
  limit?: string | number;
}

interface TribeRequest {
  query?: RequestQuery;
  protocol?: string;
  originalUrl?: string;
  user?: UserRecord;
  tribe?: TribeRecord | null;
}

type ListTribesRequest = TribeRequest & { query: RequestQuery };

type MemberRequest = TribeRequest & {
  user: UserRecord & { _id: Types.ObjectId };
  tribe: TribeRecord & { _id: Types.ObjectId };
};

interface JsonResponse<Body> {
  send(body: unknown): this;
  status(code: number): this;
  json(body: Body | { message?: string }): this;
}

type Next = (error?: unknown) => void;
type ErrorResponse = { message?: string };
interface PaginatedResponse extends JsonResponse<TribeRecord[]> {
  set(key: string, value: string): this;
  links(links: Record<string, string>): this;
  locals: { url: string; paginate: { href(query: { page: number }): string } };
}

const service = {} as {
  tribeFields: string;
  tribePopulateOptions(select?: string): {
    path: string;
    select: string;
    model: string;
  };
  listTribes(req: ListTribesRequest, res: PaginatedResponse): void;
  getTribe(
    req: TribeRequest,
    res: JsonResponse<TribeRecord | Record<string, never>>,
  ): void;
  listMembers(
    req: MemberRequest,
    res: JsonResponse<MemberListResponse>,
    next: Next,
  ): Promise<unknown>;
  tribeBySlug(
    req: TribeRequest,
    res: JsonResponse<ErrorResponse | TribeRecord>,
    next: Next,
    slug: string,
  ): void;
  updateCount(
    id: string | Types.ObjectId,
    difference: number | string,
    returnUpdated: boolean,
    callback: (error: Error | null, tribe?: TribeRecord | null) => void,
  ): void;
};

const Tribe = mongoose.model<TribeRecord>('Tribe');
const User = mongoose.model<UserRecord>('User');
const Contact = mongoose.model<ContactRecord>('Contact');
const Experience = mongoose.model<ExperienceRecord>('Experience');
const MEMBER_ONLY_TRIBE_SLUGS = ['naturists'];

// Publicly exposed fields from tribes
service.tribeFields = [
  '_id',
  'slug',
  'label',
  'count',
  'color',
  'image',
  'attribution',
  'attribution_url',
  'description',
  'created',
].join(' ');

/** Populate options for the tribe of a member document. */
service.tribePopulateOptions = function (select = service.tribeFields) {
  return {
    path: 'member.tribe',
    select,
    model: 'Tribe',
  };
};

function visibleTribesQuery(req: TribeRequest): Record<string, unknown> {
  const query: Record<string, unknown> = { public: true };
  if (!req.user) {
    query.slug = { $nin: MEMBER_ONLY_TRIBE_SLUGS };
  }
  return query;
}

/** List all public tribes. */
service.listTribes = function (req, res) {
  const queryParams = req.query;
  const sort: Record<string, 'desc'> =
    queryParams.sortBy === 'alphabetically'
      ? { label: 'desc' as const }
      : { count: 'desc' as const };
  const page = parseInt(String(queryParams.page), 10) || 1;
  const limitMatch = req.originalUrl?.match(/limit=(\d+)/);
  const limit = limitMatch
    ? parseInt(limitMatch[1], 10)
    : parseInt(String(queryParams.limit), 10) || 0;
  const query = visibleTribesQuery(req);

  Tribe.find(query)
    .select(service.tribeFields)
    .sort(sort)
    .limit(limit)
    .skip((page - 1) * limit)
    .exec((error, docs) => {
      if (error) {
        errorService.sendBadRequest(res, error);
        return;
      }
      Tribe.countDocuments(query, (countError: Error | null, total: number) => {
        if (countError) {
          errorService.sendBadRequest(res, countError);
          return;
        }
        const pages = Math.ceil(total / limit);
        if (pages > page) {
          paginationService.setLinkHeader(req, res, pages, { relative: true });
        }
        res.json(docs);
      });
    });
};

/** Return the tribe attached by the route parameter middleware. */
service.getTribe = function (req, res) {
  res.json(req.tribe || {});
};

function visibleMemberMatch(
  req: MemberRequest,
  excludedIDs: Types.ObjectId[],
  prefix = '',
): Record<string, unknown> {
  const blocked = req.user.blocked || [];
  return {
    [`${prefix}_id`]: {
      $nin: [req.user._id, ...blocked, ...excludedIDs],
    },
    [`${prefix}public`]: true,
    [`${prefix}roles`]: { $nin: userRolesService.restrictedMessagingRoles },
    [`${prefix}blocked`]: { $nin: [req.user._id] },
    [`${prefix}member.tribe`]: req.tribe._id,
  };
}

const DISCOVERY_QUERY_TIMEOUT_MS = 1000;

async function listCircleContacts(req: MemberRequest): Promise<MemberView[]> {
  const selfId = req.user._id;
  return Contact.aggregate<MemberView>([
    {
      $match: {
        confirmed: true,
        $or: [{ userFrom: selfId }, { userTo: selfId }],
      },
    },
    {
      $project: {
        userId: {
          $cond: [{ $eq: ['$userFrom', selfId] }, '$userTo', '$userFrom'],
        },
      },
    },
    { $group: { _id: '$userId' } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    { $match: visibleMemberMatch(req, [], 'user.') },
    { $sort: { 'user.displayName': 1, 'user._id': 1 } },
    { $limit: 20 },
    { $project: userMiniService.userMiniProjection('$user') },
  ])
    .option({ maxTimeMS: DISCOVERY_QUERY_TIMEOUT_MS })
    .exec();
}

async function listCircleRecommenders(
  req: MemberRequest,
  excludedIDs: Types.ObjectId[],
): Promise<MemberView[]> {
  const selfId = req.user._id;
  return Experience.aggregate<MemberView>([
    {
      $match: {
        userTo: selfId,
        userFrom: {
          $nin: [selfId, ...(req.user.blocked || []), ...excludedIDs],
        },
        public: true,
        recommend: 'yes',
      },
    },
    { $sort: { created: -1 } },
    { $group: { _id: '$userFrom', created: { $first: '$created' } } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    { $match: visibleMemberMatch(req, excludedIDs, 'user.') },
    { $sort: { created: -1, _id: 1 } },
    { $limit: 20 },
    { $project: userMiniService.userMiniProjection('$user') },
  ])
    .option({ maxTimeMS: DISCOVERY_QUERY_TIMEOUT_MS })
    .exec();
}

/** List a signed-in circle member's bounded, privacy-filtered discovery groups. */
service.listMembers = async function (req, res, next) {
  try {
    const isMember = req.user.member?.some(member =>
      member.tribe.equals(req.tribe._id),
    );
    if (!isMember) {
      return errorService.sendForbidden(res);
    }

    const contacts = await listCircleContacts(req);
    const contactIDs = contacts.map(member => member._id);
    const recommenders = await listCircleRecommenders(req, contactIDs);
    const recommenderIDs = recommenders.map(member => member._id);
    const active = await User.find({
      ...visibleMemberMatch(req, [...contactIDs, ...recommenderIDs]),
      seen: { $gte: moment().subtract(1, 'month').toDate() },
    })
      .select(userMiniService.userMiniProfileFields)
      .sort({ seen: -1, _id: 1 })
      .limit(8)
      .maxTimeMS(DISCOVERY_QUERY_TIMEOUT_MS)
      .lean()
      .exec();

    return res.json({ contacts, recommenders, active });
  } catch (error) {
    return next(error);
  }
};

/** Load a public tribe by slug for the route parameter middleware. */
service.tribeBySlug = function (req, res, next, slug) {
  if (!req.user && MEMBER_ONLY_TRIBE_SLUGS.includes(slug)) {
    errorService.sendForbidden(res);
    return;
  }
  Tribe.findOne({ public: true, slug }, service.tribeFields).exec(
    (error, tribe) => {
      if (error) {
        errorService.sendBadRequest(res, error);
        return;
      }
      req.tribe = tribe;
      return next();
    },
  );
};

/** Update cached member count for a tribe. */
service.updateCount = function (id, difference, returnUpdated, callback) {
  Tribe.findByIdAndUpdate(
    id,
    { $inc: { count: parseInt(String(difference)) } },
    { safe: false, new: Boolean(returnUpdated) },
    callback,
  );
};

const getTribe = service.getTribe;
const listMembers = service.listMembers;
const listTribes = service.listTribes;
const tribeBySlug = service.tribeBySlug;
const tribeFields = service.tribeFields;
const tribePopulateOptions = service.tribePopulateOptions;
const updateCount = service.updateCount;
export {
  getTribe,
  listMembers,
  listTribes,
  tribeBySlug,
  tribeFields,
  tribePopulateOptions,
  updateCount,
};
export default service;
export { service as 'module.exports' };
