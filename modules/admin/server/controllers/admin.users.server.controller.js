/**
 * Module dependencies.
 */
const _ = require('lodash');
const escapeStringRegexp = require('escape-string-regexp');
const mongoose = require('mongoose');
const User = mongoose.model('User');

/*
 * This middleware sends response with an array of found users
 */
exports.searchUsers = (req, res, next) => {
  const search = _.get(req, ['query', 'search']);

  // Validate the query string
  if (!search || search.length < 3) {
    return res.status(400).send({
      message: 'Query string at least 3 characters long required.'
    });
  }

  const regexpSearch = new RegExp('.*' + escapeStringRegexp(search) + '.*', 'i');

  User
    .find({ $or: [
      { 'email': regexpSearch },
      { 'username': regexpSearch },
      { 'displayName': regexpSearch }
    ] })
    .select('_id email username displayName public roles')
    .sort('username displayName')
    .limit(50)
    .exec((err, users) => {
      if (err) {
        return next(err);
      }
      return res.send(users || []);
    });
};

/*
 * This middleware sends response with an array of found users
 */
exports.getUser = (req, res, next) => {
  const userId = _.get(req, ['query', 'id']);

  // Check that the search string is provided
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({
      message: 'Invalid or missing ID.'
    });
  }

  User
    .findById(userId)
    // Avoid pulling in sensitive fields from Mongoose
    .select('-password -salt')
    .exec((err, user) => {
      if (err) {
        return next(err);
      }
      return res.send(user || {});
    });
};
