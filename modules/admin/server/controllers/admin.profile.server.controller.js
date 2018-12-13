'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    path = require('path'),
    errorService = require(path.resolve('./modules/core/server/services/error.server.service')),
    textService = require(path.resolve('./modules/core/server/services/text.server.service')),
    tribesHandler = require(path.resolve('./modules/tribes/server/controllers/tribes.server.controller')),
    contactHandler = require(path.resolve('./modules/contacts/server/controllers/contacts.server.controller')),
    messageHandler = require(path.resolve('./modules/messages/server/controllers/messages.server.controller')),
    offerHandler = require(path.resolve('./modules/offers/server/controllers/offers.server.controller')),
    emailService = require(path.resolve('./modules/core/server/services/email.server.service')),
    pushService = require(path.resolve('./modules/core/server/services/push.server.service')),
    statService = require(path.resolve('./modules/stats/server/services/stats.server.service')),
    log = require(path.resolve('./config/lib/logger')),
    del = require('del'),
    messageStatService = require(path.resolve(
      './modules/messages/server/services/message-stat.server.service')),
    config = require(path.resolve('./config/config')),
    async = require('async'),
    crypto = require('crypto'),
    sanitizeHtml = require('sanitize-html'),
    mkdirRecursive = require('mkdir-recursive'),
    mongoose = require('mongoose'),
    multer = require('multer'),
    fs = require('fs'),
    os = require('os'),
    mmmagic = require('mmmagic'),
    moment = require('moment'),
    multerConfig = require(path.resolve('./config/lib/multer')),
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

  // perform the search
  User
    .find({ $and: [
      {}, // public: true }, // only public users
      {
        $text: {
          $search: req.query.search
        }
      }
    ] }, { score: { $meta: 'textScore' } })
    // select only the right profile properties
    //    .select(exports.userMiniProfileFields + ' -_id')
    .sort({ score: { $meta: 'textScore' } })
    // limit the amount of found users (config)
    .limit(config.limits.userSearchLimit)
    .exec(function (err, users) {
      if (err) return next(err);
      return res.send(users);
    });
};
