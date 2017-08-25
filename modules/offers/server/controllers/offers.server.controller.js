'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    path = require('path'),
    async = require('async'),
    errorService = require(path.resolve('./modules/core/server/services/error.server.service')),
    userProfile = require(path.resolve('./modules/users/server/controllers/users.profile.server.controller')),
    tribes = require(path.resolve('./modules/tags/server/controllers/tribes.server.controller')),
    textService = require(path.resolve('./modules/core/server/services/text.server.service')),
    log = require(path.resolve('./config/lib/logger')),
    sanitizeHtml = require('sanitize-html'),
    moment = require('moment'),
    mongoose = require('mongoose'),
    Offer = mongoose.model('Offer'),
    User = mongoose.model('User');

// Selected fields to return publicly for offers
var publicOfferFields = [
  '_id',
  'type',
  'status',
  'user',
  'description',
  'noOfferDescription',
  'maxGuests',
  'location',
  'updated',
  'validUntil'
];

// Offer fields users can modify
var allowedOfferFields = [
  'status',
  'description',
  'noOfferDescription',
  'maxGuests',
  'location'
];

/**
 * Parse filters object from json string
 */
function parseFiltersString(filtersString) {
  try {
    var filtersObject = JSON.parse(filtersString);

    // Handle non-exception-throwing cases:
    // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
    // but... JSON.parse(null) returns null, and typeof null === "object",
    // so we must check for that, too. Thankfully, null is falsey, so this suffices.
    // @link http://stackoverflow.com/a/20392392/1984644
    if (filtersObject && typeof filtersObject === 'object') {
      return filtersObject;
    }
  } catch (e) {
    return false;
  }
}

/**
 * Sanitize offer fields
 */
function sanitizeOffer(offer, authenticatedUserId, alwaysFuzzyLocation) {
  // offer is a Mongo document, turn it into regular JS object
  // so that we can modify it on the fly
  offer = offer.toObject();

  // Sanitize each outgoing offer's contents
  // Offers are already sanitized when they go into the database,
  // but this is more lightweight sanitization just in case we've changed
  // our sanitization settings since we stored this data. And just in case.
  if (!_.isUndefined(offer.description)) {
    offer.description = sanitizeHtml(offer.description, textService.sanitizeOptions);
  }
  if (!_.isUndefined(offer.noOfferDescription)) {
    offer.noOfferDescription = sanitizeHtml(offer.noOfferDescription, textService.sanitizeOptions);
  }

  // Make sure we return accurate location only for offer owner,
  // others will see pre generated fuzzy location
  if (alwaysFuzzyLocation || !authenticatedUserId || !authenticatedUserId.equals((offer.user._id || offer.user))) {
    offer.location = offer.locationFuzzy;
  }

  // Pick fields to send out, leaves out e.g. `locationFuzzy` and `reactivateReminderSent`
  offer = _.pick(offer, publicOfferFields);

  return offer;
}

/**
 * Validate latitude/longitude coordinates
 * @TODO: overly complex
 *
 * @param {Float} coordinate - Expects latitude or longitude coordinate
 * @param {String} type - Either `lat` or `lng`, anything else fails the test.
 * @returns {Boolean} true on success, false on failure.
 */
function isValidCoordinate(coordinate, type) {

  // Validate that parameters are defined
  if (_.isUndefined(coordinate) || _.isUndefined(type)) {
    return false;
  }

  // Ensure coordinate is finite number
  if (!_.isFinite(parseFloat(coordinate))) {
    return false;
  }

  var range;
  // Test latitude range
  if (type === 'lat') {
    range = 90;
  }
  // Test longitude range
  else if (type === 'lng') {
    range = 180;
  } else {
    // `type` wasn't `lat` nor `lng` => fail
    return false;
  }

  // Quick check for range (`-90 to 90` or `-180 to 180`)
  // This is done again at regexp but regexp doesn't catch ranges for non-floats
  if (!_.inRange(coordinate, -Math.abs(range), range)) {
    return false;
  }

  // How long coordinate digits are allowed?
  var length = 30;

  // Test with regexp
  var regexp = new RegExp('^(\\+|-)?(\\d\.\\d{1,' + length + '}|[1-8]\\d\.\\d{1,' + length + '}|' + range + '\\.0{1,' + length + '})$');

  var valid = regexp.test(coordinate);
  return valid;
}

/**
 * Validate offer type
 *
 * @param {String} type - Offer type ("host" or "meet")
 * @returns {Boolean} true on success, false on failure.
 */
function isValidOfferType(type) {
  // Get list of valid offer types directly from Mongoose Schema
  var validOfferTypes = Offer.schema.path('type').enumValues || [];

  return type && validOfferTypes.indexOf(type) > -1;
}

/**
 * Create (or update if exists) a Offer
 */
exports.create = function (req, res) {

  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden')
    });
  }

  // Validate type
  if (!req.body.type || !isValidOfferType(req.body.type)) {
    return res.status(400).send({
      message: 'Missing or invalid offer type.'
    });
  }

  // Missing required fields
  if (!req.body.location) {
    return res.status(400).send({
      message: 'Missing offer location.'
    });
  }

  // Create new offer by filtering out what users can modify
  // When creating an offer, we allow type field
  var offer = new Offer(_.pick(req.body, _.concat(allowedOfferFields, 'type')));

  offer.user = req.user._id;

  // Any other type but `host` offers expire within a month
  if (!offer.type || offer.type !== 'host') {
    offer.validUntil = moment().add(30, 'day').toDate();
  }

  // Update timestamp
  offer.updated = new Date();

  // Do the upsert, which works like this: If no Offer document exists with
  // _id = offer.id, then create a new doc using upsertData.
  // Otherwise, update the existing doc with upsertData
  // @link http://stackoverflow.com/a/7855281
  offer.save(function (err) {
    if (err) {
      return res.status(400).send({
        message: 'Failed to save offer.'
      });
    }

    res.json({
      message: 'Offer saved.'
    });
  });

};

/**
 * Update an Offer
 */
exports.update = function (req, res) {

  async.waterfall([

    // Validate
    function (done) {

      if (!req.user) {
        return res.status(403).send({
          message: errorService.getErrorMessageByKey('forbidden')
        });
      }

      // Missing required fields
      if (!req.body.location) {
        return res.status(400).send({
          message: 'Missing offer location.'
        });
      }

      // Attempting to change offer type yelds error
      if (req.body.type && req.body.type !== req.offer.type) {
        return res.status(400).send({
          message: 'You cannot update offer type.'
        });
      }

      done();
    },

    // Create offer object and modify it
    function (done) {

      // Pick only fields user is allowed to modify
      var offerModifications = _.pick(req.body, allowedOfferFields);

      // Extend offer in request (picked by `offerById` middleware earlier)
      var offer = _.extend(req.offer, offerModifications);

      // Any other type but `host` offers expire within a month
      if (req.offer.type !== 'host') {
        offer.validUntil = moment().add(30, 'day').toDate();
      }

      // Update timestamp
      offer.updated = new Date();

      // Reset reactivate reminders
      // Setting this to undefined will remove the field
      offer.set('reactivateReminderSent', undefined);

      done(null, offer);
    },

    // Save offer
    function (offer, done) {
      offer.save(function (err) {
        done(err);
      });
    },

    // Done!
    function () {
      return res.json({
        message: 'Offer updated.'
      });
    }

  ], function (err) {
    if (err) {
      return res.status(400).send({
        message: errorService.getErrorMessage(err)
      });
    }
  });

};


/**
 * Delete an Offer
 */
exports.delete = function (req, res) {

  // User can remove only their own offers
  if (!req.user || !req.offer.user._id.equals(req.user._id)) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden')
    });
  }

  Offer.findOneAndRemove({
    _id: req.offer._id,
    user: req.user._id
  }, function (err) {
    if (err) {
      return res.status(400).send({
        message: errorService.getErrorMessage(err)
      });
    }

    res.json({
      message: 'Offer removed.'
    });
  });
};

/**
 * List of Offers
 */
exports.list = function (req, res) {

  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden')
    });
  }

  // Validate required bounding box query parameters
  var coordinateKeys = ['southWestLat', 'southWestLng', 'northEastLat', 'northEastLng'];
  var isCoordinatesValid = _.every(coordinateKeys, function (coordinateKey) {

    // Get query string from query
    // If there is no query string (`req.query`), it is the empty object, `{}`.
    var coordinate = _.get(req.query, coordinateKey, false);

    // Trim string coordinates
    // This is because when using `+` in front of a coordinate,
    // it'll translate to empty space which would fail validation
    // Before querying database, we'll anyway turn coordinate into Float
    if (typeof coordinate === 'string') {
      coordinate = coordinate.trim();
    }

    // Gets either `lat` or `lng`
    var coordinateType = coordinateKey.substr(-3).toLowerCase();

    // Validate
    return isValidCoordinate(coordinate, coordinateType);
  });

  // Stop if any found invalid coordinate
  if (!isCoordinatesValid) {
    return res.status(400).send({
      message: 'Invalid or missing coordinate. ' +
        'Required coordinates: ' + coordinateKeys.join(', ') + '.'
    });
  }

  // Parse filters
  var filters;
  if (req.query.filters && req.query.filters !== '') {
    filters = parseFiltersString(req.query.filters);

    // Could not parse filters json string into object
    if (!filters) {
      return res.status(400).send({
        message: 'Could not parse filters.'
      });
    }

  }

  // Basic query has always bounding box
  var query = [{
    $match: {
      locationFuzzy: {
        $geoWithin: {
          // Note:
          // http://docs.mongodb.org/manual/reference/operator/query/box
          // -> It's latitude first as in the database, not longitude first as in the documentation
          $box: [
            [parseFloat(req.query.southWestLat), parseFloat(req.query.southWestLng)],
            [parseFloat(req.query.northEastLat), parseFloat(req.query.northEastLng)]
          ]
        }
      }
    }
  }];

  // Status filter
  // Note that `type:meet` are currently all `status:yes`
  query.push({
    $match: {
      $or: [
        { status: 'yes' },
        { status: 'maybe' },
        { status: { $exists: false } }
      ]
    }
  });

  // Don't return outdated offers
  query.push({
    $match: {
      $or: [
        { validUntil: { $gte: new Date() } },
        { validUntil: { $exists: false } }
      ]
    }
  });

  // Types filter
  if (_.has(filters, 'types') && _.isArray(filters.types) && filters.types.length > 0) {

    // Accept only valid values, ignore the rest
    // @link https://lodash.com/docs/#filter
    var filterTypes = _.filter(filters.types, function (type) {
      return isValidOfferType(type);
    });

    // If we still have types left, apply the filter
    if (filterTypes.length) {
      query.push({
        $match: {
          type: {
            $in: filterTypes
          }
        }
      });
    }
  }

  // Rest of the filters are based on user schema
  // @TODO do this query only when we actually need it.
  if (_.has(filters, 'tribes') && _.isArray(filters.tribes) && filters.tribes.length > 0) {
    query.push({
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user'
      }
    });
    // Because above `$lookup` returns an array with one user
    // `[{userObject}]`, we have to unwind it back to `{userObject}`
    query.push({
      $unwind: '$user'
    });
  }

  // Tribes filter
  if (_.has(filters, 'tribes') && _.isArray(filters.tribes) && filters.tribes.length > 0) {

    var tribeQueries = [];

    var isTribeFilterValid = filters.tribes.every(function (tribeId) {
      // Return failure if tribe id is invalid, otherwise add id to query array
      return mongoose.Types.ObjectId.isValid(tribeId) &&
             tribeQueries.push({
               'user.member.tag': new mongoose.Types.ObjectId(tribeId)
             });
    });

    if (!isTribeFilterValid) {
      return res.status(400).send({
        message: errorService.getErrorMessageByKey('invalid-id')
      });
    }

    // Build the query
    if (tribeQueries.length > 1) {
      // Match multible tribes
      query.push({
        $match: {
          $or: tribeQueries
        }
      });
    } else {
      // Just one tribe
      query.push({
        $match: tribeQueries[0]
      });
    }

  }

  // Pick fields to receive
  query.push({
    $project: {
      _id: '$_id',
      location: '$locationFuzzy',
      status: '$status',
      type: '$type'
      /*
      user: {
        _id: '$user._id',
        member: '$user.member'
      }
      */
    }
  });

  Offer
    .aggregate(query)
    .exec()
    .then(function (offers) {
      res.json(offers);
    }, function (err) {
      // Log the failure
      log('error', 'Querying for offers caused an error. #g28fb1', {
        error: err
      });
      return res.status(400).send({
        message: errorService.getErrorMessage(err)
      });
    });
};


/**
 * Return offers
 */
exports.listOffersByUser = function (req, res) {
  res.json(req.offers || []);
};

/**
 * Return an offer
 */
exports.getOffer = function (req, res) {

  async.waterfall([

    function (done) {

      // Don't proceed if offer doesn't have user
      if (!req.offer || !req.offer.user || !req.offer.location) {
        return res.status(404).send({
          message: errorService.getErrorMessageByKey('not-found')
        });
      }

      done(null, req.offer);
    },

    // Populate `tag` fields from objects at `offer.user.member` array
    function (offer, done) {

      // Nothing to populate
      if (!offer.user.member && !offer.user.member.length) {
        return done(null, offer);
      }

      User.populate(offer.user, {
        path: 'member.tag',
        select: tribes.tribeFields,
        model: 'Tag'
        // Not possible at the moment due bug in Mongoose
        // http://mongoosejs.com/docs/faq.html#populate_sort_order
        // https://github.com/Automattic/mongoose/issues/2202
        // options: { sort: { count: -1 } }
      }, function (err, user) {
        // Overwrite old `offer.user` with new `user` object
        // containing populated `member.tag` to `offer`
        offer.user = user;
        done(err, offer);
      });

    },

    function (offer) {
      // Sanitize offer before returning it
      var offer = sanitizeOffer(offer, req.user._id);

      res.json(offer);
    }

  ], function (err) {
    if (err) {
      // Something's wrong and we weren't prepared for itx
      log('error', 'Failed to load offer. #g34gss', {
        error: err
      });
      return res.status(400).send({
        message: errorService.getErrorMessageByKey('default')
      });
    }
  });

};

// Offer reading middleware
exports.offersByUserId = function (req, res, next, userId) {

  // Authenticated user required
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden')
    });
  }

  // Validate userId is valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id')
    });
  }

  // Database query
  var query = {
    user: userId,
    $or: [
      { validUntil: { $gte: new Date() } },
      { validUntil: { $exists: false } }
    ]
  };

  // Validate optional type parameter
  if (_.has(req.query, 'types')) {

    // Get list of valid offer types directly from Mongoose Schema
    var validOfferTypes = Offer.schema.path('type').enumValues;

    // Ensure we have array of type(s)
    // 3rd parameter sets max limit for array length,
    // ensuring users can't send insanely long arrays for our queries
    var queryTypes = _.split(req.query.types, ',', validOfferTypes.length);

    queryTypes.forEach(function (paramType) {
      // Return failure if type is invalid, otherwise add type to query array
      if (paramType && validOfferTypes.indexOf(paramType) > -1) {
        // Returns array length if other types exist already in db query,
        // otherwise returns `0`
        var i = (_.get(query, 'type.$in') || []).length;
        // Add type to db query array
        // Results with `query`:
        // ```
        // {
        //   user: userId,
        //   type: {
        //     $in: [
        //       'host',
        //       ...
        //     ]
        //   }
        // }
        // ```
        _.set(query, 'type.$in[' + i + ']', paramType);
      } else {
        console.info('Ignored invalid offer type: ' + textService.plainText(paramType));
      }
    });

  }

  // Get offers
  Offer.find(query, function (err, offers) {

    // Errors
    if (err) {
      return next(err);
    }

    if (!offers || !offers.length) {
      return res.status(404).send({
        message: errorService.getErrorMessageByKey('not-found')
      });
    }

    // Sanitize offers
    req.offers = _.map(offers, function (offer) {
      return sanitizeOffer(offer, req.user._id);
    });

    next();
  });

};

// Offer reading middleware
exports.offerById = function (req, res, next, offerId) {
  // Require user
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden')
    });
  }

  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(offerId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id')
    });
  }

  async.waterfall([

    // Find offer
    function (done) {
      Offer.findById(offerId)
        .populate('user', userProfile.userListingProfileFields)
        .exec(function (err, offer) {

          // No offer
          if (err) {
            log('error', 'Getting offer by id caused an error. #2kg3g3', {
              error: err
            });
          }

          if (err || !offer) {
            return res.status(404).send({
              message: errorService.getErrorMessageByKey('not-found')
            });
          }

          done(null, offer);
        });
    },

    // Continue
    function (offer, done) {

      req.offer = offer;

      done();
    }

  ], function (err) {
    if (err) {
      log('error', 'Getting offer by id caused an error. #g34gj3', {
        error: err
      });
    }
    return next(err);
  });

};

/**
 * Clear all offers by user id
 */
exports.removeAllByUserId = function (userId, callback) {
  Offer.remove({
    user: userId
  }, function (err) {
    if (callback) {
      callback(err);
    }
  });
};
