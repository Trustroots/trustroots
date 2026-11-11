import errorService from '../../../core/server/services/error.server.service.mjs';
import paginationService from '../../../core/server/services/pagination.server.service.mjs';
import mongoose, { type PipelineStage, type Types } from 'mongoose';
import moment from 'moment';
import userMiniService from '../../../users/server/services/user-mini.server.service.mjs';
import { findDiscoveryHostingLocations } from '../../../users/server/services/discovery-hosting.server.service.mts';
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
  seen?: Date;
}

type Activity = 'today' | 'week' | 'month' | 'older';
type DiscoveryMember = Omit<MemberView, 'seen'> & {
  activity?: Activity;
  hosting?: boolean;
};

interface MemberListResponse {
  contacts: DiscoveryMember[];
  recommenders: DiscoveryMember[];
  active: DiscoveryMember[];
}

interface ConnectionsResponse {
  recent: DiscoveryMember[];
  hosts: (Pick<MemberView, '_id' | 'username' | 'displayName'> & {
    location: [number, number];
  })[];
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

type ConnectionRequest = TribeRequest & {
  user: UserRecord & { _id: Types.ObjectId };
};

type MemberRequest = ConnectionRequest & {
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
  listConnections(
    req: ConnectionRequest,
    res: JsonResponse<ConnectionsResponse>,
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
    .exec()
    .then(docs =>
      Tribe.countDocuments(query).then(total => {
        const pages = Math.ceil(total / limit);
        // Stryker disable next-line ConditionalExpression,EqualityOperator: setLinkHeader repeats the same page < pageCount check itself, so calling it on the last page (or with NaN pages) sets no header either way
        if (pages > page) {
          paginationService.setLinkHeader(req, res, pages, { relative: true });
        }
        res.json(docs);
      }),
    )
    .catch((error: Error) => {
      errorService.sendBadRequest(res, error);
    });
};

/** Return the tribe attached by the route parameter middleware. */
service.getTribe = function (req, res) {
  res.json(req.tribe || {});
};

function visibleMemberMatch(
  req: ConnectionRequest,
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
    ...(req.tribe?._id && { [`${prefix}member.tribe`]: req.tribe._id }),
  };
}

const DISCOVERY_QUERY_TIMEOUT_MS = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const discoveryFields = ['locationLiving', 'locationFrom', 'tagline', 'seen'];
const discoverySelect = `${userMiniService.userMiniProfileFields} ${discoveryFields.join(' ')}`;

function memberSummary(
  { seen, ...profile }: MemberView,
  now: Date,
): DiscoveryMember {
  if (!(seen instanceof Date) || !Number.isFinite(seen.getTime()))
    return profile;
  const days = (now.getTime() - seen.getTime()) / DAY_MS;
  const activity =
    days < 1 ? 'today' : days < 7 ? 'week' : days <= 30 ? 'month' : 'older';
  return { ...profile, activity };
}

function visibleMemberStages(
  req: MemberRequest,
  excludedIDs: Types.ObjectId[],
  sort: Record<string, 1 | -1>,
): PipelineStage[] {
  return [
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
    { $sort: sort },
    { $limit: 20 },
    {
      $project: userMiniService.userMiniProjection(
        '$user',
        Object.fromEntries(
          discoveryFields.map(field => [field, `$user.${field}`]),
        ),
      ),
    },
  ];
}

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
    // Stryker disable next-line ArrayDeclaration: a stray string in an $nin list over ObjectId fields never matches, so no input can tell it from the empty list
    ...visibleMemberStages(req, [], { 'user.displayName': 1, 'user._id': 1 }),
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
          // Stryker disable next-line ArrayDeclaration: only a pre-filter; the later user match excludes the viewer, blocked users and contacts again, so the result is identical
          $nin: [selfId, ...(req.user.blocked || []), ...excludedIDs],
        },
        public: true,
        recommend: 'yes',
      },
    },
    // Stryker disable next-line UnaryOperator: the unique (userFrom, userTo) index leaves one experience per recommender, so $first is the same under either sort direction
    { $sort: { created: -1 } },
    { $group: { _id: '$userFrom', created: { $first: '$created' } } },
    ...visibleMemberStages(req, excludedIDs, { created: -1, _id: 1 }),
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

    const now = new Date();
    const contacts = await listCircleContacts(req);
    const contactIDs = contacts.map(member => member._id);
    const recommenders = await listCircleRecommenders(req, contactIDs);
    const recommenderIDs = recommenders.map(member => member._id);
    const active = await User.find({
      ...visibleMemberMatch(req, [...contactIDs, ...recommenderIDs]),
      seen: { $gte: moment(now).subtract(1, 'month').toDate() },
    })
      .select(discoverySelect)
      .sort({ seen: -1, _id: 1 })
      .limit(8)
      .maxTimeMS(DISCOVERY_QUERY_TIMEOUT_MS)
      .lean()
      .exec();

    const ownerIDs = [...contacts, ...recommenders, ...active].map(
      member => member._id,
    );
    const locations = await findDiscoveryHostingLocations(
      ownerIDs,
      ownerIDs,
      now,
    );
    const summarise = (member: MemberView): DiscoveryMember => ({
      ...memberSummary(member, now),
      ...(locations.has(member._id.toString()) && { hosting: true }),
    });
    return res.json({
      contacts: contacts.map(summarise),
      recommenders: recommenders.map(summarise),
      active: active.map(summarise),
    });
  } catch (error) {
    return next(error);
  }
};

/** Find recent and hosting connections for the signed-in homepage. */
service.listConnections = async function (req, res, next) {
  try {
    const selfId = req.user._id;
    const now = new Date();
    const [outgoing, incoming, recommenders] = await Promise.all([
      Contact.distinct('userTo', { userFrom: selfId, confirmed: true })
        .maxTimeMS(DISCOVERY_QUERY_TIMEOUT_MS)
        .exec(),
      Contact.distinct('userFrom', { userTo: selfId, confirmed: true })
        .maxTimeMS(DISCOVERY_QUERY_TIMEOUT_MS)
        .exec(),
      Experience.distinct('userFrom', {
        userTo: selfId,
        public: true,
        recommend: 'yes',
      })
        .maxTimeMS(DISCOVERY_QUERY_TIMEOUT_MS)
        .exec(),
    ]);
    const match = {
      $and: [
        visibleMemberMatch(req, []),
        { _id: { $in: [...outgoing, ...incoming, ...recommenders] } },
      ],
    };
    const [recent, connections] = await Promise.all([
      User.find({
        ...match,
        seen: { $gte: new Date(now.getTime() - 30 * DAY_MS) },
      })
        .select(discoverySelect)
        .sort({ seen: -1, _id: 1 })
        .limit(9)
        .maxTimeMS(DISCOVERY_QUERY_TIMEOUT_MS)
        .lean<MemberView[]>()
        .exec(),
      User.find(match)
        .select('username displayName member.tribe')
        .maxTimeMS(DISCOVERY_QUERY_TIMEOUT_MS)
        .lean<(MemberView & Pick<UserRecord, 'member'>)[]>()
        .exec(),
    ]);
    const viewerCircles = new Set(
      req.user.member?.map(({ tribe }) => tribe.toString()),
    );
    const locations = await findDiscoveryHostingLocations(
      connections.map(({ _id }) => _id),
      connections
        .filter(({ member }) =>
          member?.some(({ tribe }) => viewerCircles.has(tribe.toString())),
        )
        .map(({ _id }) => _id),
      now,
    );
    const hosts = connections.flatMap(({ _id, username, displayName }) => {
      const location = locations.get(_id.toString());
      return location && username && displayName
        ? [{ _id, username, displayName, location }]
        : [];
    });
    return res.json({
      recent: recent.map(member => memberSummary(member, now)),
      hosts,
    });
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
  Tribe.findOne({ public: true, slug }, service.tribeFields)
    .exec()
    .then(
      tribe => {
        req.tribe = tribe;
        return next();
      },
      (error: Error) => {
        errorService.sendBadRequest(res, error);
      },
    );
};

/** Update cached member count for a tribe. */
service.updateCount = function (id, difference, returnUpdated, callback) {
  Tribe.findByIdAndUpdate(
    id,
    { $inc: { count: parseInt(String(difference)) } },
    { new: Boolean(returnUpdated) },
  ).then(tribe => callback(null, tribe), callback);
};

const getTribe = service.getTribe;
const listMembers = service.listMembers;
const listConnections = service.listConnections;
const listTribes = service.listTribes;
const tribeBySlug = service.tribeBySlug;
const tribeFields = service.tribeFields;
const tribePopulateOptions = service.tribePopulateOptions;
const updateCount = service.updateCount;
/** @esmNamed */
export {
  getTribe,
  listMembers,
  listConnections,
  listTribes,
  tribeBySlug,
  tribeFields,
  tribePopulateOptions,
  updateCount,
};
export default service;
