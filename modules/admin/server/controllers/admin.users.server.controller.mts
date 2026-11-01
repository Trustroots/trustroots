/**
 * Module dependencies.
 */
import _ from 'lodash';
import mongoose, {
  type QueryFilter,
  type HydratedDocument,
  type Types,
  type UpdateQuery,
  type PipelineStage,
} from 'mongoose';
import { prepareStaffBlockers } from '../services/staff-blockers-payload.server.service.mts';

import errorService from '../../../core/server/services/error.server.service.mjs';
import type { ValidationFailure } from '../../../core/server/services/error.server.service.mts';
import log from '../../../../config/lib/logger.mjs';
import { ACCOUNT_IDENTIFIER_MAX_LENGTH } from '../../../users/server/lib/account-identifier.server.mjs';
import {
  type AdminIdentity,
  getAdminIdentityIdentifiers,
  getUniqueAdminIdentityIdentifiers,
} from '../services/admin-identity.server.service.mts';

interface UserRecord {
  _id: Types.ObjectId;
  acquisitionStory?: string;
  additionalProvidersData?: Record<string, unknown>;
  authVersion?: number;
  blocked: Types.ObjectId[];
  created?: Date;
  displayName?: string;
  email?: string;
  emailTemporary?: string;
  firstName?: string;
  lastIpHash?: string;
  lastName?: string;
  member?: Array<{ tribe: Types.ObjectId }>;
  newsletter?: boolean;
  public?: boolean;
  removeProfileExpires?: Date | null;
  removeProfileToken?: string | null;
  resetPasswordExpires?: Date | null;
  resetPasswordToken?: string | null;
  roles: string[];
  username: string;
}

interface AdminNoteRecord {
  admin: Types.ObjectId | string;
  user: Types.ObjectId | string;
  note: string;
}

interface ContactRecord {
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
}

interface MessageRecord {
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
}

interface OfferRecord {
  user: Types.ObjectId;
}

interface ReferenceThreadRecord {
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  reference: 'yes' | 'no';
  created?: Date;
}

interface ThreadRecord {
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
}

type UserDocument = HydratedDocument<UserRecord>;
type ObjectIdInput =
  | string
  | Types.ObjectId
  | Buffer
  | Uint8Array
  | { id: string | Buffer; toHexString(): string };

function isObjectIdInput(value: unknown): value is ObjectIdInput {
  return (
    typeof value === 'string' ||
    Buffer.isBuffer(value) ||
    value instanceof Uint8Array ||
    (typeof value === 'object' &&
      value !== null &&
      'toHexString' in value &&
      typeof value.toHexString === 'function' &&
      'id' in value &&
      (typeof value.id === 'string' || Buffer.isBuffer(value.id)))
  );
}

interface AdminRequest {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  userIdFromUsername?: unknown;
  user?: { _id: Types.ObjectId | string; roles: string[] };
}

type PotentialMatchUser = Pick<UserRecord, '_id' | 'username'> &
  Partial<Pick<UserRecord, 'acquisitionStory' | 'email' | 'emailTemporary'>>;

interface AdminListRequest extends AdminRequest {
  body?: {
    page?: unknown;
    search?: unknown;
    role?: unknown;
    ipHash?: unknown;
    sort?: { column?: unknown; direction?: unknown };
  };
}

interface AdminResponse {
  status(code: number | undefined): AdminResponse;
  send(body: unknown): unknown;
}

interface AdminNext {
  (): void;
}

const AdminNote = mongoose.model<AdminNoteRecord>('AdminNote');
const Contact = mongoose.model<ContactRecord>('Contact');
const Experience = mongoose.model('Experience');
const Message = mongoose.model<MessageRecord>('Message');
const Offer = mongoose.model<OfferRecord>('Offer');
const ReferenceThread =
  mongoose.model<ReferenceThreadRecord>('ReferenceThread');
const Thread = mongoose.model<ThreadRecord>('Thread');
const User = mongoose.model<UserRecord>('User');

const ADMIN_MEMBER_PAGE_SIZE = 150;
const POTENTIAL_MATCH_LIMIT = 25;
const POTENTIAL_MATCH_MIN_IDENTIFIER_LENGTH = 4;
const SEARCH_STRING_LIMIT = 3;
const ADMIN_MEMBER_SORT_FIELDS = {
  created: 'created',
  displayName: 'displayName',
  email: 'email',
  lastIpHash: 'lastIpHash',
  username: 'username',
} as const;
type AdminMemberSortColumn = keyof typeof ADMIN_MEMBER_SORT_FIELDS;
const DEFAULT_ADMIN_MEMBER_SORT = {
  column: 'username',
  direction: 'ascending',
};
const ADMIN_LISTABLE_ROLES = [
  'welcome-team',
  'support-team',
  'admin',
  'shadowban',
  'suspended',
  'volunteer-alumni',
  'volunteer',
] as const;
type AdminListableRole = (typeof ADMIN_LISTABLE_ROLES)[number];
function isListableRole(value: unknown): value is AdminListableRole {
  return ADMIN_LISTABLE_ROLES.some(role => role === value);
}
const ADMIN_CHANGEABLE_ROLES = [
  'welcome-team',
  'support-team',
  'shadowban',
  'suspended',
  'volunteer-alumni',
  'volunteer',
] as const;
type AdminChangeableRole = (typeof ADMIN_CHANGEABLE_ROLES)[number];
function isChangeableRole(value: unknown): value is AdminChangeableRole {
  return ADMIN_CHANGEABLE_ROLES.some(role => role === value);
}

// Everything that's needed for `AdminSearchUsers.component.js` and `UserState.component.js`
const USER_LIST_FIELDS = [
  '_id',
  'created',
  'displayName',
  'email',
  'emailTemporary',
  'lastIpHash',
  'public',
  'removeProfileExpires',
  'removeProfileToken',
  'resetPasswordExpires',
  'resetPasswordToken',
  'roles',
  'username',
];

const POTENTIAL_MATCH_FIELDS = [...USER_LIST_FIELDS, 'acquisitionStory'];

const EMPTY_EXPERIENCE_STATS = {
  total: 0,
  positive: 0,
  negative: 0,
  neutral: 0,
  unpublished: 0,
};

function experienceStatsStages(
  field: 'userFrom' | 'userTo',
  userId: Types.ObjectId,
): PipelineStage.FacetPipelineStage[] {
  const publishedRecommendation = (
    recommendation: 'yes' | 'no' | 'unknown',
  ) => ({
    $sum: {
      $cond: [
        {
          $and: [
            { $eq: ['$public', true] },
            { $eq: ['$recommend', recommendation] },
          ],
        },
        1,
        0,
      ],
    },
  });
  return [
    { $match: { [field]: userId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        positive: publishedRecommendation('yes'),
        negative: publishedRecommendation('no'),
        neutral: publishedRecommendation('unknown'),
        unpublished: { $sum: { $cond: [{ $eq: ['$public', false] }, 1, 0] } },
      },
    },
    { $project: { _id: 0 } },
  ];
}

/**
 * Overwrite tokens from results as a security measure.
 * We still want to pull this info to know if it's there.
 */
function obfuscateTokens(user: UserDocument | null | undefined) {
  if (!user) {
    return;
  }

  // Mongo object to regular object
  const _user = user.toObject();
  // Historical MongoDB fields may remain until the maintenance script runs.
  _.unset(_user, 'lastIpAddress');

  [
    // 'emailToken', // Needed to generate email reset links visible at dashboard
    'removeProfileToken',
    'resetPasswordToken',
    // Arrays just to speed up lodash operations. That's what lodash does internally anyway
    ['additionalProvidersData', 'facebook', 'accessToken'],
    ['additionalProvidersData', 'facebook', 'refreshToken'],
    ['additionalProvidersData', 'github', 'accessToken'],
    ['additionalProvidersData', 'github', 'refreshToken'],
    ['additionalProvidersData', 'twitter', 'token'],
    ['additionalProvidersData', 'twitter', 'tokenSecret'],
  ].forEach(path => {
    if (_.has(_user, path)) {
      _.set(_user, path, '(Hidden from admins.)');
    }
  });

  return _user;
}

/**
 * From https://github.com/sindresorhus/escape-string-regexp/blob/ba9a4473850cb367936417e97f1f2191b7cc67dd/index.js
 * Import as a package once we support ESM modules
 */
function escapeStringRegexp(string: string): string {
  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');
}

function createMemberSearchRegexp(search: unknown): RegExp {
  if (typeof search !== 'string') {
    throw new TypeError('Expected a string');
  }

  const whitespaceTolerantSearch = search
    .split(/\s+/)
    .map(escapeStringRegexp)
    .join('\\s*');

  return new RegExp('.*' + whitespaceTolerantSearch + '.*', 'i');
}

function normalizeAcquisitionStory(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function createFlexibleIdentifierRegexp(
  identifier: string,
  emailLocalPartOnly: boolean,
): RegExp {
  const pattern = identifier
    .split('')
    .map(escapeStringRegexp)
    .join('[\\s._+\\x2d]*');

  return new RegExp(
    emailLocalPartOnly ? `^[^@]*${pattern}[^@]*@` : pattern,
    'i',
  );
}

interface PotentialMatchSignals {
  acquisitionStory: string;
  identifiers: AdminIdentity[];
}

function getPotentialMatchSignals(
  user: PotentialMatchUser,
): PotentialMatchSignals {
  const signals = getUniqueAdminIdentityIdentifiers(
    {
      username: user.username,
      email: user.email!,
      emailTemporary: user.emailTemporary!,
    },
    POTENTIAL_MATCH_MIN_IDENTIFIER_LENGTH,
  );
  const acquisitionStory = normalizeAcquisitionStory(user.acquisitionStory!);

  return {
    acquisitionStory,
    identifiers: signals,
  };
}

function getPotentialMatchReasons(
  user: PotentialMatchUser,
  signals: PotentialMatchSignals,
): string[] {
  const candidateIdentifiers = getAdminIdentityIdentifiers({
    username: user.username,
    email: user.email!,
    emailTemporary: user.emailTemporary!,
  }).map(({ value }) => value);
  const reasons: string[] = signals.identifiers
    .filter(({ value }) =>
      candidateIdentifiers.some(identifier => identifier.includes(value)),
    )
    .map(({ label }) => label);

  if (
    signals.acquisitionStory &&
    normalizeAcquisitionStory(user.acquisitionStory!) ===
      signals.acquisitionStory
  ) {
    reasons.push('Acquisition story');
  }

  return reasons;
}

/** @esmNamed */
export async function findPotentialMatches(user: PotentialMatchUser) {
  const signals = getPotentialMatchSignals(user);
  const querySignals: QueryFilter<UserRecord>[] = signals.identifiers.flatMap(
    ({ value }) => [
      { username: createFlexibleIdentifierRegexp(value, false) },
      { email: createFlexibleIdentifierRegexp(value, true) },
      { emailTemporary: createFlexibleIdentifierRegexp(value, true) },
    ],
  );

  if (signals.acquisitionStory) {
    querySignals.push({
      acquisitionStory: new RegExp(
        `^\\s*${signals.acquisitionStory
          .split(' ')
          .map(escapeStringRegexp)
          .join('\\s+')}\\s*$`,
        'i',
      ),
    });
  }

  if (!querySignals.length) {
    return [];
  }

  const matches = await User.find({
    _id: { $ne: user._id },
    $or: querySignals,
  })
    .select(POTENTIAL_MATCH_FIELDS)
    .sort({ created: -1, _id: 1 })
    .limit(POTENTIAL_MATCH_LIMIT)
    .exec();

  return matches.map(match => ({
    ...obfuscateTokens(match),
    matchReasons: getPotentialMatchReasons(match, signals),
  }));
}

interface MemberListOptions {
  page: number;
  sort: {
    column: AdminMemberSortColumn;
    direction: 'ascending' | 'descending';
  };
}

function getMemberListOptions(body: unknown): MemberListOptions | null {
  const page = _.get(body, ['page'], 1);
  const sortColumn = _.get(
    body,
    ['sort', 'column'],
    DEFAULT_ADMIN_MEMBER_SORT.column,
  );
  const sortDirection = _.get(
    body,
    ['sort', 'direction'],
    DEFAULT_ADMIN_MEMBER_SORT.direction,
  );

  if (
    !Number.isInteger(page) ||
    page < 1 ||
    typeof sortColumn !== 'string' ||
    !Object.prototype.hasOwnProperty.call(
      ADMIN_MEMBER_SORT_FIELDS,
      sortColumn,
    ) ||
    !['ascending', 'descending'].includes(sortDirection)
  ) {
    return null;
  }

  return {
    page,
    sort: {
      column: sortColumn as AdminMemberSortColumn,
      direction: sortDirection as 'ascending' | 'descending',
    },
  };
}

async function sendMemberList(
  req: AdminListRequest,
  res: AdminResponse,
  query: QueryFilter<UserRecord>,
): Promise<unknown> {
  const options = getMemberListOptions(req.body);

  if (!options) {
    return res.status(400).send({
      message: 'Invalid member-list options.',
    });
  }

  try {
    const total = await User.countDocuments(query).exec();
    const totalPages = Math.ceil(total / ADMIN_MEMBER_PAGE_SIZE);
    const page = Math.min(options.page, Math.max(totalPages, 1));
    const sortValue = options.sort.direction === 'ascending' ? 1 : -1;
    const users = await User.find(query)
      .select(USER_LIST_FIELDS)
      .sort({
        [ADMIN_MEMBER_SORT_FIELDS[options.sort.column]]: sortValue,
        _id: 1,
      })
      .skip((page - 1) * ADMIN_MEMBER_PAGE_SIZE)
      .limit(ADMIN_MEMBER_PAGE_SIZE)
      .exec();

    return res.send({
      users: users ? users.map(obfuscateTokens) : [],
      pagination: {
        page,
        pageSize: ADMIN_MEMBER_PAGE_SIZE,
        total,
        totalPages,
      },
      sort: options.sort,
    });
  } catch (err) {
    return res.status(400).send({
      message: errorService.getErrorMessage(err as ValidationFailure),
    });
  }
}

/*
 * This middleware sends a page of found users.
 */
/** @esmNamed */
export const searchUsers = (req: AdminListRequest, res: AdminResponse) => {
  const query = _.get(req, ['body', 'search']);
  const search = typeof query === 'string' ? _.trim(query) : query;
  const searchLength = search
    ? Reflect.get(Object(search), 'length')
    : undefined;

  // Validate the query string
  if (
    !search ||
    (searchLength !== undefined && Number(searchLength) < SEARCH_STRING_LIMIT)
  ) {
    return res.status(400).send({
      message: `Query string at least ${SEARCH_STRING_LIMIT} characters long required.`,
    });
  }

  const regexpSearch = createMemberSearchRegexp(search);

  return sendMemberList(req, res, {
    $or: [
      { displayName: regexpSearch },
      { email: regexpSearch },
      { emailTemporary: regexpSearch },
      { username: regexpSearch },
    ],
  });
};

/*
 * This middleware sends a page of users with the selected role.
 */
/** @esmNamed */
export const listUsersByRole = (req: AdminListRequest, res: AdminResponse) => {
  const role = _.get(req, ['body', 'role']);

  // Allowed roles to query
  if (!isListableRole(role)) {
    return res.status(400).send({
      message: 'Invalid role.',
    });
  }

  return sendMemberList(req, res, {
    roles: { $in: [role] },
  });
};

/*
 * This middleware sends members whose current stored IP identifier exactly matches.
 */
/** @esmNamed */
export const listUsersByLastIpHash = (
  req: AdminListRequest,
  res: AdminResponse,
) => {
  const ipHash = _.get(req, ['body', 'ipHash']);

  if (typeof ipHash !== 'string' || !/^[a-f0-9]{64}$/.test(ipHash)) {
    return res.status(400).send({
      message: 'Invalid IP identifier.',
    });
  }

  return sendMemberList(req, res, { lastIpHash: ipHash });
};

const handleAdminApiError = (res: AdminResponse, err: unknown): unknown => {
  /* istanbul ignore else */
  if (err) {
    return res.status(400).send({
      message: errorService.getErrorMessage(err as ValidationFailure),
    });
  }
};

/**
 * This middleware sends response with an array of found users
 * @esmNamed
 */
export const getUser = async (
  req: AdminRequest,
  res: AdminResponse,
): Promise<unknown> => {
  const userId = req.userIdFromUsername || _.get(req, ['body', 'id']);

  if (!userId && _.get(req, ['body', 'username'])) {
    return res.status(404).send({
      message: errorService.getErrorMessageByKey('not-found'),
    });
  }

  // Check that the search string is provided
  if (
    !userId ||
    !isObjectIdInput(userId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  try {
    const objectId = new mongoose.Types.ObjectId(userId);
    const user = await User.findById(objectId)
      // Avoid pulling in sensitive fields from Mongoose
      .select('-password -salt')
      .populate({
        path: 'member.tribe',
        select: 'slug label',
        model: 'Tribe',
      });

    if (!user) {
      return res.status(404).send({
        message: errorService.getErrorMessageByKey('not-found'),
      });
    }

    const messageFromCount = await Message.countDocuments({
      userFrom: objectId,
    });

    const messageToCount = await Message.countDocuments({ userTo: objectId });

    const threadCount = await Thread.countDocuments({
      $or: [{ userFrom: objectId }, { userTo: objectId }],
    });

    // @TODO these could be compiled using aggregate grouping
    const threadReferencesSentNo = await ReferenceThread.countDocuments({
      userFrom: objectId,
      reference: 'no',
    });

    const threadReferencesReceivedNo = await ReferenceThread.countDocuments({
      userTo: objectId,
      reference: 'no',
    });

    const threadReferencesReceivedYes = await ReferenceThread.countDocuments({
      userTo: objectId,
      reference: 'yes',
    });

    const threadReferencesSentYes = await ReferenceThread.countDocuments({
      userFrom: objectId,
      reference: 'yes',
    });

    const threadReferences = await ReferenceThread.find({
      $or: [{ userFrom: objectId }, { userTo: objectId }],
    })
      .sort('-created')
      .limit(100)
      .populate({
        path: 'userFrom',
        select: 'username displayName _id',
        model: 'User',
      })
      .populate({
        path: 'userTo',
        select: 'username displayName _id',
        model: 'User',
      });

    const contacts = await Contact.find({
      $or: [{ userFrom: objectId }, { userTo: objectId }],
    })
      .populate({
        path: 'userFrom',
        select: 'username displayName',
        model: 'User',
      })
      .populate({
        path: 'userTo',
        select: 'username displayName',
        model: 'User',
      });

    const offers = await Offer.find({ user: objectId });

    // Aggregations do not cast IDs, unlike Mongoose find queries.
    const experienceUserId = user._id;
    const [experienceStats] = await Experience.aggregate([
      {
        $match: {
          removedAt: { $exists: false },
          $or: [{ userFrom: experienceUserId }, { userTo: experienceUserId }],
        },
      },
      {
        $facet: {
          received: experienceStatsStages('userTo', experienceUserId),
          written: experienceStatsStages('userFrom', experienceUserId),
        },
      },
    ]);

    const isRestricted = ['shadowban', 'suspended'].some(role =>
      user.roles.includes(role),
    );
    const potentialMatches = isRestricted
      ? await findPotentialMatches(user)
      : [];

    res.send({
      contacts: contacts || [],
      experiencesReceived: {
        ...EMPTY_EXPERIENCE_STATS,
        ...experienceStats.received[0],
      },
      experiencesWritten: {
        ...EMPTY_EXPERIENCE_STATS,
        ...experienceStats.written[0],
      },
      messageFromCount,
      messageToCount,
      offers: offers || [],
      potentialMatches,
      profile: obfuscateTokens(user),
      threadCount,
      threadReferencesSentNo,
      threadReferencesReceivedNo,
      threadReferencesReceivedYes,
      threadReferences: threadReferences || [],
      threadReferencesSentYes,
    });
  } catch (err) {
    log('error', 'Failed to load member in admin tool. #ggi323', {
      error: err,
    });
    handleAdminApiError(res, err);
  }
};

/**
 * Admins inspect blockers of all staff; Welcome team members inspect their own.
 * @esmNamed
 */
export const listStaffBlockers = async (
  req: AdminRequest,
  res: AdminResponse,
) => {
  try {
    const staffMembers = req.user!.roles.includes('admin')
      ? await User.find({
          roles: { $in: ['admin', 'welcome-team', 'support-team'] },
        })
          .select('username displayName')
          .sort({ username: 1 })
          .lean()
      : await User.find({ _id: req.user!._id })
          .select('username displayName')
          .lean();
    const staffIds = staffMembers.map(staff => staff._id);
    const blockers = staffIds.length
      ? await User.find({ blocked: { $in: staffIds } })
          .select('username displayName blocked')
          .sort({ username: 1 })
          .lean()
      : [];

    const staffBlockers = prepareStaffBlockers(staffMembers, blockers);
    res.send(staffBlockers);
  } catch (err) {
    log('error', 'Failed to load members who blocked staff.', { error: err });
    handleAdminApiError(res, err);
  }
};

/**
 * This middleware changes user roles by ID
 * Used for suspending, shadowbanning, and restoring users
 * @esmNamed
 */
export const changeRole = async (
  req: AdminRequest,
  res: AdminResponse,
): Promise<unknown> => {
  const userId = _.get(req, ['body', 'id']);
  const roleValue = _.get(req, ['body', 'role']);

  const actionValue = _.get(req, ['body', 'action'], 'add');
  if (
    !isChangeableRole(roleValue) ||
    (actionValue !== 'add' && actionValue !== 'remove') ||
    (actionValue === 'remove' &&
      !['welcome-team', 'support-team', 'shadowban'].some(
        allowedRole => allowedRole === roleValue,
      ))
  ) {
    return res.status(400).send({
      message: 'Invalid role.',
    });
  }
  const role = roleValue as AdminChangeableRole;
  const action: 'add' | 'remove' = actionValue;

  // Check that the search string is provided
  if (
    !userId ||
    !isObjectIdInput(userId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  try {
    const id = new mongoose.Types.ObjectId(userId as ObjectIdInput);
    let changedUser = false;

    // Compare-and-set the role array so overlapping updates cannot overwrite
    // another role change or lose an authVersion increment.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const current = await User.findById(id).select('roles').lean().exec();
      if (!current) break;

      const currentRoles = current.roles || [];
      const nextRoles = currentRoles.filter(existingRole => {
        if (action === 'remove') return existingRole !== role;
        if (
          (role === 'volunteer' && existingRole === 'volunteer-alumni') ||
          (role === 'volunteer-alumni' && existingRole === 'volunteer') ||
          (role === 'shadowban' && existingRole === 'suspended') ||
          (role === 'suspended' && existingRole === 'shadowban')
        ) {
          return false;
        }
        return true;
      });
      if (action === 'add' && !nextRoles.includes(role)) nextRoles.push(role);

      const rolesChanged =
        currentRoles.length !== nextRoles.length ||
        currentRoles.some(
          (existingRole, index) => existingRole !== nextRoles[index],
        );
      const filter: QueryFilter<UserRecord> = { _id: id };
      filter.roles = Object.prototype.hasOwnProperty.call(current, 'roles')
        ? current.roles
        : { $exists: false };
      const update: UpdateQuery<UserRecord> = { $set: { roles: nextRoles } };
      if (action === 'add' && role === 'suspended') {
        update.$set = { ...update.$set, newsletter: false, public: false };
      }
      if (rolesChanged) update.$inc = { authVersion: 1 };

      const result = await User.updateOne(filter, update);
      if (result.matchedCount) {
        changedUser = true;
        break;
      }
    }

    if (!changedUser) {
      return res.status(404).send({
        message: errorService.getErrorMessageByKey('not-found'),
      });
    }

    let roleChangeMessage = `Role "${role}" ${
      action === 'remove' ? 'removed' : 'added'
    }.`;

    // If adding role 'volunteer-alumni', remove 'volunteer' role
    if (action === 'add' && role === 'volunteer-alumni') {
      roleChangeMessage = 'User made into volunteer-alumni.';
    }

    // If adding role 'volunteer', remove 'volunteer-alumni' role
    if (action === 'add' && role === 'volunteer') {
      roleChangeMessage = 'User made into volunteer.';
    }

    // If adding role 'shadowban', remove 'suspended' role
    if (action === 'add' && role === 'shadowban') {
      roleChangeMessage = 'User shadowbanned.';
    }

    if (action === 'remove' && role === 'shadowban') {
      roleChangeMessage = 'User unshadowbanned.';
    }

    // If adding role 'suspended', remove 'shadowban' role
    if (action === 'add' && role === 'suspended') {
      roleChangeMessage = 'User suspended.';
    }

    // Add new admin-note about role change
    const adminNoteItem = new AdminNote({
      admin: req.user!._id,
      note: `<p><b>Performed action:</b></p><p><i>${roleChangeMessage}</i></p>`,
      user: userId,
    });
    await adminNoteItem.save();

    res.send({ message: 'Role changed.' });
  } catch (err) {
    log('error', 'Failed to update member in admin tool. #ggi323', {
      error: err,
    });
    handleAdminApiError(res, err);
  }
};

/** @esmNamed */
export const usernameToUserId = async (
  req: AdminRequest,
  res: Partial<AdminResponse>,
  next: AdminNext,
): Promise<unknown> => {
  const username = _.get(req, ['body', 'username']);

  if (
    username !== undefined &&
    (typeof username !== 'string' ||
      username.length > ACCOUNT_IDENTIFIER_MAX_LENGTH)
  ) {
    return res.status!(400).send!({ message: 'Invalid username.' });
  }

  // Get userID based on provided username
  if (username) {
    const user = await User.findOne({ username }).setOptions({
      sanitizeFilter: true,
    });

    if (user) {
      req.userIdFromUsername = user._id;
    }
  }

  next();
};

const service = {
  searchUsers,
  listUsersByRole,
  listUsersByLastIpHash,
  getUser,
  listStaffBlockers,
  findPotentialMatches,
  changeRole,
  usernameToUserId,
};

export default service;

/** @commonjs */
export { service as 'module.exports' };
