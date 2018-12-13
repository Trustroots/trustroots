'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    path = require('path'),
    errorService = require(path.resolve('./modules/core/server/services/error.server.service')),
    mongoose = require('mongoose'),
    User = mongoose.model('User');

/*
 * This middleware sends response with an array of found users
 * We assume that req.query.search exists
 */
exports.adminSearch = function (req, res, next) {

  // check that the search string is provided
  if (!_.has(req.query, 'search')) {
    return next();
  }

  // validate the query string
  if (req.query.search.length < 3) {
    var errorMessage = errorService.getErrorMessageByKey('bad-request');
    return res.status(400).send({
      message: errorMessage,
      detail: 'Query string should be at least 3 characters long.'
    });
  }

  var query = req.query.search;
  // perform the search
  var regexp_query = new RegExp('.*' + query + '.*', 'i');

  //  if (query.match(/^[0-9a-fA-F]{24}$/)) {
  //    query = '0'.repeat(24);
  //  }

  User
    .find({ $or: [
      //     { '_id': query },   // Cast to ObjectId failed
      { 'email': regexp_query },
      { 'username': regexp_query },
      { 'displayName': regexp_query }
    ] })
    // select only the right profile properties
    //    .select(exports.userMiniProfileFields + ' -_id')
    .sort()
    .limit(30)
    .exec(function (err, users) {
      if (err) return next(err);
      return res.send(users);
    });
};
