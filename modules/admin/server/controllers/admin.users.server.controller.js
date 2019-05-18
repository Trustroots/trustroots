/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const errorService = require(path.resolve('./modules/core/server/services/error.server.service'));
const escapeStringRegexp = require('escape-string-regexp');
const mongoose = require('mongoose');
const log = require(path.resolve('./config/lib/logger'));

const Contact = mongoose.model('Contact');
const Message = mongoose.model('Message');
const Offer = mongoose.model('Offer');
const ReferenceThread = mongoose.model('ReferenceThread');
const Thread = mongoose.model('Thread');
const User = mongoose.model('User');

const SEARCH_USERS_LIMIT = 50;
const SEARCH_STRING_LIMIT = 3;

/**
 * Overwrite tokens from results as a security measure.
 * We still want to pull this info to know if it's there.
 */
function obfuscateWriteTokens(user) {
  if (!user) {
    return;
  }

  // Mongo object to regular object
  const _user = user.toObject();

  [
    'emailToken',
    'removeProfileToken',
    'resetPasswordToken',
    // Arrays just to speed up lodash operations. That's what lodash does internally anyway
    ['additionalProvidersData', 'facebook', 'accessToken'],
    ['additionalProvidersData', 'facebook', 'refreshToken'],
    ['additionalProvidersData', 'github', 'accessToken'],
    ['additionalProvidersData', 'github', 'refreshToken'],
    ['additionalProvidersData', 'twitter', 'token'],
    ['additionalProvidersData', 'twitter', 'tokenSecret']
  ].forEach((path) => {
    if (_.has(_user, path)) {
      _.set(_user, path, '(Hidden from admins.)');
    }
  });

  return _user;
}

/*
 * This middleware sends response with an array of found users
 */
exports.searchUsers = (req, res) => {
  const search = _.get(req, ['body', 'search']);

  // Validate the query string
  if (!search || search.length < SEARCH_STRING_LIMIT) {
    return res.status(400).send({
      message: `Query string at least ${ SEARCH_STRING_LIMIT } characters long required.`
    });
  }

  const regexpSearch = new RegExp('.*' + escapeStringRegexp(search) + '.*', 'i');

  User
    .find({ $or: [
      { 'displayName': regexpSearch },
      { 'email': regexpSearch },
      { 'emailTemporary': regexpSearch },
      { 'username': regexpSearch }
    ] })
    // Everything that's needed for `AdminSearchUsers.component.js` and `UserState.component.js`
    .select([
      '_id',
      'displayName',
      'email',
      'emailTemporary',
      'public',
      'removeProfileExpires',
      'removeProfileToken',
      'resetPasswordExpires',
      'resetPasswordToken',
      'roles',
      'username'
    ])
    .sort('username displayName')
    .limit(SEARCH_USERS_LIMIT)
    .exec((err, users) => {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err)
        });
      }

      const result = users ? users.map(obfuscateWriteTokens) : [];

      return res.send(result);
    });
};

const handleAdminApiError = (res, err) => {
  if (err) {
    return res.status(400).send({
      message: errorService.getErrorMessage(err)
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
      message: errorService.getErrorMessageByKey('invalid-id')
    });
  }

  try {
    const user = await User
      .findById(userId)
      // Avoid pulling in sensitive fields from Mongoose
      .select('-password -salt')
      .populate({
        path: 'member.tribe',
        select: 'slug label',
        model: 'Tribe'
      });

    if (!user) {
      return res.status(404).send({
        message: errorService.getErrorMessageByKey('not-found')
      });
    }

    const messageFromCount = await Message
      .find({ 'userFrom': userId })
      .count();

    const messageToCount = await Message
      .find({ 'userTo': userId })
      .count();

    const threadCount = await Thread
      .find({ $or: [
        { 'userFrom': userId },
        { 'userTo': userId }
      ] })
      .count();

    // @TODO these could be compiled using aggregate grouping
    const threadReferencesSentNo = await ReferenceThread
      .find({ 'userFrom': userId, 'reference': 'no' })
      .count();

    const threadReferencesReceivedNo = await ReferenceThread
      .find({ 'userTo': userId, 'reference': 'no' })
      .count();

    const threadReferencesReceivedYes = await ReferenceThread
      .find({ 'userFrom': userId, 'reference': 'yes' })
      .count();

    const threadReferencesSentYes = await ReferenceThread
      .find({ 'userto': userId, 'reference': 'yes' })
      .count();

    const contacts = await Contact
      .find({ $or: [
        { 'userFrom': userId },
        { 'userTo': userId }
      ] })
      .populate({
        path: 'userFrom',
        select: 'username displayName',
        model: 'User'
      })
      .populate({
        path: 'userTo',
        select: 'username displayName',
        model: 'User'
      });

    const offers = await Offer.find({ user: userId });

    res.send({
      contacts: contacts || [],
      messageFromCount,
      messageToCount,
      offers: offers || [],
      profile: obfuscateWriteTokens(user),
      threadCount,
      threadReferencesSentNo,
      threadReferencesReceivedNo,
      threadReferencesReceivedYes,
      threadReferencesSentYes
    });
  } catch (err) {
    log('error', 'Failed to load member in admin tool. #ggi323', {
      error: err
    });
    handleAdminApiError(res, err);
  }
};
