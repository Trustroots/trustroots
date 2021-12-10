/**
 * Module dependencies.
 */
const _ = require('lodash');
const mongoose = require('mongoose');
const path = require('path');

const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));
const log = require(path.resolve('./config/lib/logger'));

const AdminNote = mongoose.model('AdminNote');
const Contact = mongoose.model('Contact');
const Message = mongoose.model('Message');
const Offer = mongoose.model('Offer');
const ReferenceThread = mongoose.model('ReferenceThread');
const Thread = mongoose.model('Thread');
const User = mongoose.model('User');

const SEARCH_USERS_LIMIT = 50;
const SEARCH_STRING_LIMIT = 3;

// Everything that's needed for `AdminSearchUsers.component.js` and `UserState.component.js`
const USER_LIST_FIELDS = [
  '_id',
  'created',
  'displayName',
  'email',
  'emailTemporary',
  'public',
  'removeProfileExpires',
  'removeProfileToken',
  'resetPasswordExpires',
  'resetPasswordToken',
  'roles',
  'username',
];

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
  if (typeof string !== 'string') {
    throw new TypeError('Expected a string');
  }

  // Escape characters with special meaning either inside or outside character sets.
  // Use a simple backslash escape when it’s always valid, and a `\xnn` escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
  return string.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');
}

/*
 * This middleware sends response with an array of found users
 */
exports.searchUsers = (req, res) => {
  const search = _.get(req, ['body', 'search']);

  // Validate the query string
  if (!search || search.length < SEARCH_STRING_LIMIT) {
    return res.status(400).send({
      message: `Query string at least ${SEARCH_STRING_LIMIT} characters long required.`,
    });
  }

  const regexpSearch = new RegExp(
    '.*' + escapeStringRegexp(search) + '.*',
    'i',
  );

  User.find({
    $or: [
      { displayName: regexpSearch },
      { email: regexpSearch },
      { emailTemporary: regexpSearch },
      { username: regexpSearch },
    ],
  })
    .select(USER_LIST_FIELDS)
    .sort('username displayName')
    .limit(SEARCH_USERS_LIMIT)
    .exec((err, users) => {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }

      const result = users ? users.map(obfuscateTokens) : [];

      return res.send(result);
    });
};

/*
 * This middleware sends response with an array of found users
 */
exports.listUsersByRole = (req, res) => {
  const role = _.get(req, ['body', 'role']);

  const validRoles = User.schema.path('roles').caster.enumValues || [];

  // Allowed roles to query
  if (!role || !validRoles.includes(role)) {
    return res.status(400).send({
      message: 'Invalid role.',
    });
  }

  User.find({
    roles: { $in: [role] },
  })
    .select(USER_LIST_FIELDS)
    .sort('username displayName')
    .exec((err, users) => {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }

      const result = users ? users.map(obfuscateTokens) : [];

      return res.send(result);
    });
};

const handleAdminApiError = (res, err) => {
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

    res.send({
      contacts: contacts || [],
      messageFromCount,
      messageToCount,
      offers: offers || [],
      profile: obfuscateTokens(user),
      threadCount,
      threadReferencesSentNo,
      threadReferencesReceivedNo,
      threadReferencesReceivedYes,
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
 * This middleware changes user roles by ID
 * Used for suspending users or setting them a "shadow ban"
 */
exports.changeRole = async (req, res) => {
  const userId = _.get(req, ['body', 'id']);
  const role = _.get(req, ['body', 'role']);

  const validRoles = User.schema.path('roles').caster.enumValues || [];

  // Allowed new roles — for security reasons never allow `admin` role to be changed programmatically.
  if (!role || role === 'admin' || !validRoles.includes(role)) {
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
