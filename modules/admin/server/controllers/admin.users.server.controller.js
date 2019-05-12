/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const errorService = require(path.resolve('./modules/core/server/services/error.server.service'));
const escapeStringRegexp = require('escape-string-regexp');
const mongoose = require('mongoose');
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

/**
 * This middleware sends response with an array of found users
 */
exports.getUser = (req, res) => {
  const userId = _.get(req, ['body', 'id']);

  // Check that the search string is provided
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id')
    });
  }

  User
    .findById(userId)
    // Avoid pulling in sensitive fields from Mongoose
    .select('-password -salt')
    .populate({
      path: 'member.tribe',
      select: 'slug label',
      model: 'Tribe'
    })
    .exec((err, user) => {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err)
        });
      }

      if (!user) {
        return res.status(404).send({
          message: errorService.getErrorMessageByKey('not-found')
        });
      }

      return res.send(obfuscateWriteTokens(user));
    });
};
