/**
 * Module dependencies.
 */
const _ = require('lodash');
const mongoose = require('mongoose');
const net = require('net');

const errorService = require('../../../core/server/services/error.server.service');
const log = require('../../../../config/lib/logger');

const AdminNote = mongoose.model('AdminNote');
const Contact = mongoose.model('Contact');
const Message = mongoose.model('Message');
const Offer = mongoose.model('Offer');
const ReferenceThread = mongoose.model('ReferenceThread');
const Thread = mongoose.model('Thread');
const User = mongoose.model('User');

const ADMIN_MEMBER_PAGE_SIZE = 150;
const POTENTIAL_MATCH_LIMIT = 25;
const POTENTIAL_MATCH_MIN_IDENTIFIER_LENGTH = 4;
const SEARCH_STRING_LIMIT = 3;
const ADMIN_MEMBER_SORT_FIELDS = {
  created: 'created',
  displayName: 'displayName',
  email: 'email',
  lastIpAddress: 'lastIpAddress',
  username: 'username',
};
const DEFAULT_ADMIN_MEMBER_SORT = {
  column: 'username',
  direction: 'ascending',
};
const ADMIN_LISTABLE_ROLES = [
  'admin',
  'shadowban',
  'suspended',
  'volunteer-alumni',
  'volunteer',
];
const ADMIN_CHANGEABLE_ROLES = [
  'shadowban',
  'suspended',
  'volunteer-alumni',
  'volunteer',
];

// Everything that's needed for `AdminSearchUsers.component.js` and `UserState.component.js`
const USER_LIST_FIELDS = [
  '_id',
  'created',
  'displayName',
  'email',
  'emailTemporary',
  'lastIpAddress',
  'public',
  'removeProfileExpires',
  'removeProfileToken',
  'resetPasswordExpires',
  'resetPasswordToken',
  'roles',
  'username',
];

const POTENTIAL_MATCH_FIELDS = [...USER_LIST_FIELDS, 'acquisitionStory'];

/**
 * Overwrite tokens from results as a security measure.
 * We still want to pull this info to know if it's there.
 */
function obfuscateTokens(user) {
  if (!user) {
    return;
  }

  // Mongo object to regular object
  const _user = user.toObject();

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
function escapeStringRegexp(string) {
  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');
}

function createMemberSearchRegexp(search) {
  if (typeof search !== 'string') {
    throw new TypeError('Expected a string');
  }

  const whitespaceTolerantSearch = search
    .split(/\s+/)
    .map(escapeStringRegexp)
    .join('\\s*');

  return new RegExp('.*' + whitespaceTolerantSearch + '.*', 'i');
}

function normalizeIdentifier(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getEmailLocalPart(value) {
  return value.split('@')[0];
}

function normalizeAcquisitionStory(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function createFlexibleIdentifierRegexp(identifier, emailLocalPartOnly) {
  const pattern = identifier
    .split('')
    .map(escapeStringRegexp)
    .join('[\\s._+\\x2d]*');

  return new RegExp(
    emailLocalPartOnly ? `^[^@]*${pattern}[^@]*@` : pattern,
    'i',
  );
}

function getPotentialMatchSignals(user) {
  const signals = [
    { label: 'Username identifier', value: normalizeIdentifier(user.username) },
    {
      label: 'Email identifier',
      value: normalizeIdentifier(getEmailLocalPart(user.email)),
    },
    {
      label: 'Temporary email identifier',
      value: normalizeIdentifier(getEmailLocalPart(user.emailTemporary)),
    },
  ].filter(
    ({ value }, index, items) =>
      value.length >= POTENTIAL_MATCH_MIN_IDENTIFIER_LENGTH &&
      items.findIndex(item => item.value === value) === index,
  );
  const acquisitionStory = normalizeAcquisitionStory(user.acquisitionStory);

  return {
    acquisitionStory,
    identifiers: signals,
  };
}

function getPotentialMatchReasons(user, signals) {
  const candidateIdentifiers = [
    normalizeIdentifier(user.username),
    normalizeIdentifier(getEmailLocalPart(user.email)),
    normalizeIdentifier(getEmailLocalPart(user.emailTemporary)),
  ];
  const reasons = signals.identifiers
    .filter(({ value }) =>
      candidateIdentifiers.some(identifier => identifier.includes(value)),
    )
    .map(({ label }) => label);

  if (
    signals.acquisitionStory &&
    normalizeAcquisitionStory(user.acquisitionStory) ===
      signals.acquisitionStory
  ) {
    reasons.push('Acquisition story');
  }

  return reasons;
}

async function findPotentialMatches(user) {
  const signals = getPotentialMatchSignals(user);
  const querySignals = signals.identifiers.flatMap(({ value }) => [
    { username: createFlexibleIdentifierRegexp(value, false) },
    { email: createFlexibleIdentifierRegexp(value, true) },
    { emailTemporary: createFlexibleIdentifierRegexp(value, true) },
  ]);

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

function getMemberListOptions(body) {
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
    !ADMIN_MEMBER_SORT_FIELDS[sortColumn] ||
    !['ascending', 'descending'].includes(sortDirection)
  ) {
    return null;
  }

  return {
    page,
    sort: {
      column: sortColumn,
      direction: sortDirection,
    },
  };
}

async function sendMemberList(req, res, query) {
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
      message: errorService.getErrorMessage(err),
    });
  }
}

/*
 * This middleware sends a page of found users.
 */
exports.searchUsers = (req, res) => {
  const query = _.get(req, ['body', 'search']);
  const search = typeof query === 'string' ? _.trim(query) : query;

  // Validate the query string
  if (!search || search.length < SEARCH_STRING_LIMIT) {
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
exports.listUsersByRole = (req, res) => {
  const role = _.get(req, ['body', 'role']);

  // Allowed roles to query
  if (!role || !ADMIN_LISTABLE_ROLES.includes(role)) {
    return res.status(400).send({
      message: 'Invalid role.',
    });
  }

  return sendMemberList(req, res, {
    roles: { $in: [role] },
  });
};

/*
 * This middleware sends members whose current stored IP address exactly matches.
 */
exports.listUsersByLastIpAddress = (req, res) => {
  const ipAddress = _.get(req, ['body', 'ipAddress']);

  if (typeof ipAddress !== 'string' || !net.isIP(ipAddress)) {
    return res.status(400).send({
      message: 'Invalid IP address.',
    });
  }

  return sendMemberList(req, res, { lastIpAddress: ipAddress });
};

const handleAdminApiError = (res, err) => {
  /* istanbul ignore else */
  if (err) {
    return res.status(400).send({
      message: errorService.getErrorMessage(err),
    });
  }
};

/**
 * This middleware sends response with an array of found users
 */
exports.getUser = async (req, res) => {
  const userId = _.get(req, ['body', 'id']);

  // Check that the search string is provided
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  try {
    const user = await User.findById(userId)
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

    const messageFromCount = await Message.find({ userFrom: userId }).count();

    const messageToCount = await Message.find({ userTo: userId }).count();

    const threadCount = await Thread.find({
      $or: [{ userFrom: userId }, { userTo: userId }],
    }).count();

    // @TODO these could be compiled using aggregate grouping
    const threadReferencesSentNo = await ReferenceThread.find({
      userFrom: userId,
      reference: 'no',
    }).count();

    const threadReferencesReceivedNo = await ReferenceThread.find({
      userTo: userId,
      reference: 'no',
    }).count();

    const threadReferencesReceivedYes = await ReferenceThread.find({
      userTo: userId,
      reference: 'yes',
    }).count();

    const threadReferencesSentYes = await ReferenceThread.find({
      userFrom: userId,
      reference: 'yes',
    }).count();

    const threadReferences = await ReferenceThread.find({
      $or: [{ userFrom: userId }, { userTo: userId }],
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
      $or: [{ userFrom: userId }, { userTo: userId }],
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

    const offers = await Offer.find({ user: userId });

    const isRestricted = ['shadowban', 'suspended'].some(role =>
      user.roles.includes(role),
    );
    const potentialMatches = isRestricted
      ? await findPotentialMatches(user)
      : [];

    res.send({
      contacts: contacts || [],
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

exports.findPotentialMatches = findPotentialMatches;

/**
 * This middleware changes user roles by ID
 * Used for suspending users or setting them a "shadow ban"
 */
exports.changeRole = async (req, res) => {
  const userId = _.get(req, ['body', 'id']);
  const role = _.get(req, ['body', 'role']);

  if (!role || !ADMIN_CHANGEABLE_ROLES.includes(role)) {
    return res.status(400).send({
      message: 'Invalid role.',
    });
  }

  // Check that the search string is provided
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  // If switching role to 'suspended', change also these settings straight up
  const additionalChangesForSuspended =
    role === 'suspended' ? { $set: { newsletter: false, public: false } } : {};

  try {
    const user = await User.updateOne(
      { _id: userId },
      {
        ...additionalChangesForSuspended,
        $addToSet: {
          roles: role,
        },
      },
    );

    // No documents were updated
    if (!user.n) {
      return res.status(404).send({
        message: errorService.getErrorMessageByKey('not-found'),
      });
    }

    let roleChangeMessage = `Role "${role}" added.`;

    // If adding role 'volunteer-alumni', remove 'volunteer' role
    if (role === 'volunteer-alumni') {
      await User.updateOne({ _id: userId }, { $pull: { roles: 'volunteer' } });
      roleChangeMessage = 'User made into volunteer-alumni.';
    }

    // If adding role 'volunteer', remove 'volunteer-alumni' role
    if (role === 'volunteer') {
      await User.updateOne(
        { _id: userId },
        { $pull: { roles: 'volunteer-alumni' } },
      );
      roleChangeMessage = 'User made into volunteer.';
    }

    // If adding role 'shadowban', remove 'suspended' role
    if (role === 'shadowban') {
      await User.updateOne({ _id: userId }, { $pull: { roles: 'suspended' } });
      roleChangeMessage = 'User shadowbanned.';
    }

    // If adding role 'suspended', remove 'shadowban' role
    if (role === 'suspended') {
      await User.updateOne({ _id: userId }, { $pull: { roles: 'shadowban' } });
      roleChangeMessage = 'User suspended.';
    }

    // Add new admin-note about role change
    const adminNoteItem = new AdminNote({
      admin: req.user._id,
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

exports.usernameToUserId = async (req, res, next) => {
  const username = _.get(req, ['body', 'username']);

  // Get userID based on provided username
  if (username) {
    const user = await User.findOne({ username });

    if (user) {
      req.userIdFromUsername = user._id;
    }
  }

  next();
};
