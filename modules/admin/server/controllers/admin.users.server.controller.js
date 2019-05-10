/**
 * Module dependencies.
 */
const _ = require('lodash');
const mongoose = require('mongoose');
const User = mongoose.model('User');

// Avoid pulling in sensitive fields from Mongoose
// Passed to Mongoose's `select()`
// https://mongoosejs.com/docs/api.html#schematype_SchemaType-select
const userFields = '-password -salt';

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

  const regexpSearch = new RegExp('.*' + search + '.*', 'i');

  User
    .find({ $or: [
      { 'email': regexpSearch },
      { 'username': regexpSearch },
      { 'displayName': regexpSearch }
    ] })
    .select(userFields)
    .sort('username displayName')
    .limit(30)
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
    .select(userFields)
    .exec((err, user) => {
      if (err) {
        return next(err);
      }
      return res.send(user || {});
    });
};
