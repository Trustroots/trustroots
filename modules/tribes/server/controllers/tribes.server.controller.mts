import errorService from '../../../core/server/services/error.server.service.mts';
import paginationService from '../../../core/server/services/pagination.server.service.mts';
import { publicTribeFields } from '../../../core/server/services/public-tribe-projection.mts';
import mongoose, { type PipelineStage, type Types } from 'mongoose';
import { subMonths } from 'date-fns';
import userMiniService from '../../../users/server/services/user-mini.server.service.mts';
import userRolesService from '../../../users/server/services/user-roles.server.service.mts';

export type ReadDiscoveryOfferLocations = (
  ownerIDs: Types.ObjectId[],
  sharedCircleOwnerIDs: Types.ObjectId[],
  now: Date,
  options?: { includeMeetings?: boolean },
) => Promise<
  Map<string, { type: 'host' | 'meet'; location: [number, number] }>
>;

interface TribeRecord {
  _id?: Types.ObjectId;
  slug?: string;
  label?: string;
  count?: number;
  description?: string;
  public?: boolean;
  organiserIds?: Types.ObjectId[];
}
interface UserRecord {
  _id?: Types.ObjectId;
  username?: string;
  displayName?: string;
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

interface ConnectionPin {
  _id: Types.ObjectId;
  username: string;
  displayName: string;
  location: [number, number];
}

interface ConnectionsResponse {
  recent: DiscoveryMember[];
  hosts: ConnectionPin[];
  meetings: ConnectionPin[];
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
  body?: { label?: unknown; description?: unknown };
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

interface TribeDetailResponse extends JsonResponse<
  TribeRecord & {
    canEdit?: true;
    organisers?: { username: string; displayName?: string }[];
  }
> {
  set(key: string, value: string): this;
}

type Next = (error?: unknown) => void;
type ErrorResponse = { message?: string };
interface PaginatedResponse extends JsonResponse<TribeRecord[]> {
  set(key: string, value: string): this;
  links(links: Record<string, string>): this;
  locals: { url: string; paginate: { href(query: { page: number }): string } };
}

const service = {} as {
  listTribes(req: ListTribesRequest, res: PaginatedResponse): void;
  getTribe(
    req: TribeRequest,
    res: TribeDetailResponse,
    next: Next,
  ): Promise<unknown>;
  editTribe(
    req: TribeRequest,
    res: TribeDetailResponse,
    next: Next,
  ): Promise<unknown>;
  listMembers(
    readDiscoveryOfferLocations: ReadDiscoveryOfferLocations,
    req: MemberRequest,
    res: JsonResponse<MemberListResponse>,
    next: Next,
  ): Promise<unknown>;
  listConnections(
    readDiscoveryOfferLocations: ReadDiscoveryOfferLocations,
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
    .select(publicTribeFields)
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

/** Return the circle with the organiser profiles visible to this viewer. */
service.getTribe = async function (req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  const { tribe, user } = req;
  if (!tribe?._id || !user?._id) {
    return res.json(tribe || {});
  }

  try {
    // Assignment IDs are excluded from the shared catalogue and HTML projection.
    const assignment = await Tribe.findById(tribe._id)
      .select('organiserIds')
      .lean()
      .exec();
    const ids = assignment?.organiserIds;
    if (!ids?.length) return res.json(tribe);
    const canEdit = mayEditCircle(user) && ids.some(id => id.equals(user._id!));
    const detail = tribe instanceof Tribe ? tribe.toJSON() : tribe;
    const editor = canEdit ? { canEdit: true as const } : {};
    if (!user.public) return res.json({ ...detail, ...editor });

    const members = await User.find({
      _id: { $in: ids, $nin: user.blocked || [] },
      public: true,
      roles: { $nin: userRolesService.restrictedMessagingRoles },
      blocked: { $nin: [user._id] },
    })
      .select('username displayName')
      .lean()
      .exec();
    const byId = new Map(
      members.map(({ _id, username, displayName }) => [
        String(_id),
        { username, displayName },
      ]),
    );
    const organisers = ids.flatMap(id => {
      const member = byId.get(String(id));
      return member?.username
        ? [{ username: member.username, displayName: member.displayName }]
        : [];
    });
    return res.json({ ...detail, ...editor, organisers });
  } catch (error) {
    return next(error);
  }
};

function mayEditCircle(user: UserRecord | undefined) {
  return (
    userRolesService.hasRole(user, 'user') &&
    !userRolesService.hasRestrictedMessagingRole(user)
  );
}

/** Update the circle's editable details while the organiser assignment is current. */
service.editTribe = async function (req, res, next) {
  const { tribe, user, body } = req;
  if (!tribe?._id || !user?._id || !mayEditCircle(user)) {
    return errorService.sendForbidden(res);
  }
  const { label, description } = body ?? {};
  if (
    (label === undefined && description === undefined) ||
    (label !== undefined && typeof label !== 'string') ||
    (description !== undefined &&
      (typeof description !== 'string' || description.length > 4000))
  ) {
    return errorService.sendBadRequest(res);
  }

  try {
    // The assignment and visibility must still match at the time of the write.
    const updated = await Tribe.findOneAndUpdate(
      { _id: tribe._id, public: true, organiserIds: user._id },
      // Mongoose omits undefined fields in updates, preserving omitted details.
      { $set: { label, description, modified: new Date() } },
      { returnDocument: 'after', runValidators: true },
    )
      .select(publicTribeFields)
      .exec();
    if (!updated) return errorService.sendForbidden(res);
    return res.json(updated);
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return errorService.sendBadRequest(res, error);
    }
    return next(error);
  }
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
service.listMembers = async function (
  readDiscoveryOfferLocations,
  req,
  res,
  next,
) {
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
      seen: { $gte: subMonths(now, 1) },
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
    const locations = await readDiscoveryOfferLocations(
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

/** Find recent and available connections for the signed-in homepage. */
service.listConnections = async function (
  readDiscoveryOfferLocations,
  req,
  res,
  next,
) {
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
    const locations = await readDiscoveryOfferLocations(
      connections.map(({ _id }) => _id),
      connections
        .filter(({ member }) =>
          member?.some(({ tribe }) => viewerCircles.has(tribe.toString())),
        )
        .map(({ _id }) => _id),
      now,
      { includeMeetings: true },
    );
    const hosts: ConnectionPin[] = [];
    const meetings: ConnectionPin[] = [];
    for (const { _id, username, displayName } of connections) {
      const offer = locations.get(_id.toString());
      if (!offer || !username || !displayName) continue;
      const pins = offer.type === 'host' ? hosts : meetings;
      pins.push({ _id, username, displayName, location: offer.location });
    }
    return res.json({
      recent: recent.map(member => memberSummary(member, now)),
      hosts,
      meetings,
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
  Tribe.findOne({ public: true, slug }, publicTribeFields)
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
const updateCount = service.updateCount;
/** @esmNamed */
export {
  getTribe,
  listMembers,
  listConnections,
  listTribes,
  tribeBySlug,
  updateCount,
};
export default service;
