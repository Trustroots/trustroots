'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    path = require('path'),
        async = require('async'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    userHandler = require(path.resolve('./modules/users/server/controllers/users.server.controller')),
    tribesHandler = require(path.resolve('./modules/tags/server/controllers/tribes.server.controller')),
    textProcessor = require(path.resolve('./modules/core/server/controllers/text-processor.server.controller')),
    sanitizeHtml = require('sanitize-html'),
    mongoose = require('mongoose'),
    Offer = mongoose.model('Offer'),
    User = mongoose.model('User');

// Selected fields to return publicly for offers
var publicOfferFields = [
  '_id',
  'status',
  'description',
  'noOfferDescription',
  'maxGuests',
  'location'
];

/**
 * Create a fuzzy offset between specified distances
 * @param {Number} minimum - Minimal distance
 * @param {Number} maximum - Maximal distance
 * @returns {Array<Number>} - array of length 2 (horizontal and vertical offset)
 */
function fuzzyOffset(minimum, maximum) {
  // Please note that Math.random() is not cryptographically secure.
  // For this purpose it's probably ok, but can be improved i.e. with node crypto module.
  if (maximum < minimum) throw new Error('maximum must be greater than minimum');
  var difference = maximum - minimum;
  var randomDistance = Math.floor(difference * Math.random() + minimum); // Distance will be from interval [minimum, maximum)
  var randomDirection = 2 * Math.PI * Math.random(); // Random direction is from interval [0, 2*PI) radians

  var horizontal = randomDistance * Math.cos(randomDirection);
  var vertical = randomDistance * Math.sin(randomDirection);

  return [horizontal, vertical]; // The order doesn't matter here
}

/**
 * Create a fuzzy location
 * Will create an alternative lat,lng by shifting location 100-200 meters to random direction
 * @link http://gis.stackexchange.com/a/2980
 */
function fuzzyLocation(location) {

  // Offsets in meters, random between 100-200 meters to random direction
  var offset = fuzzyOffset(100, 200);
  var dn = offset[0];
  var de = offset[1];

  // Position, decimal degrees
  var lat = location[0];
  var lng = location[1];

  // Earth’s radius, sphere
  var Radius = 6378137;

  // Coordinate offsets in radians
  var dLat = dn / Radius;
  var dLng = de / (Radius * Math.cos(Math.PI * lat / 180));

  // OffsetPosition, decimal degrees
  var latO = lat + dLat * 180 / Math.PI;
  var lngO = lng + dLng * 180 / Math.PI;

  return [latO, lngO];
}

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
 * Create (or update if exists) a Offer
 */
exports.create = function(req, res) {

  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  // Missing required fields
  if (!req.body.location) {
    return res.status(400).send({
      message: 'Missing offer location.'
    });
  }

  var offer = new Offer(req.body);
  offer.user = req.user;

  // Save Fuzzy location
  offer.locationFuzzy = fuzzyLocation(offer.location);

  // Sanitize contents coming from wysiwyg editors
  ['description', 'noOfferDescription'].forEach(function(key) {
    if (offer[key] && !textProcessor.isEmpty(offer[key])) {
      // Allow some HTML
      offer[key] = textProcessor.html(offer[key]);
    }
  });

  // Convert the Model instance to a simple object using Model's 'toObject' function
  // to prevent weirdness like infinite looping...
  var upsertData = offer.toObject();

  // Delete the _id property, otherwise Mongo will return a "Mod on _id not allowed" error
  delete upsertData._id;

  // Remove reminder flag
  upsertData.$unset = { reactivateReminderSent: 1 };

  // Having this present in update query would break `$unset`:ing this field
  delete upsertData.reactivateReminderSent;

  // Do the upsert, which works like this: If no Offer document exists with
  // _id = offer.id, then create a new doc using upsertData.
  // Otherwise, update the existing doc with upsertData
  // @link http://stackoverflow.com/a/7855281
  Offer.update({
    user: upsertData.user
  },
  upsertData,
  // Warning: To avoid inserting the same document more than once,
  // only use `upsert:true` if the query field is uniquely indexed.
  // This is not the case with our Schema.
  { upsert: true },
  function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }

    res.json({
      message: 'Offer saved.'
    });
  });

};


/**
 * List of Offers
 */
exports.list = function(req, res) {

  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  // Missing bounding box query parameters
  if (!req.query.southWestLat || !req.query.southWestLng || !req.query.northEastLat || !req.query.northEastLng) {
    return res.status(400).send({
      message: errorHandler.getErrorMessageByKey('default')
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
            [Number(req.query.southWestLat), Number(req.query.southWestLng)],
            [Number(req.query.northEastLat), Number(req.query.northEastLng)]
          ]
        }
      }
    }
  }];

  // Status filter
  query.push({
    $match: {
      $or: [
        { status: 'yes' },
        { status: 'maybe' }
      ]
    }
  });

  // Rest of the filters are based on user schema
  query.push({
    $lookup: {
      from: 'users',
      localField: 'user',
      foreignField: '_id',
      as: 'user'
    }
  });
  // Because above `$lookup` returns and array with one user
  // `[{userObject}]`, we have to unwind it back to `{userObject}`
  query.push({
    $unwind: '$user'
  });

  // Tribes filter
  if (filters && filters.tribes && filters.tribes.length > 0) {

    var tribeQueries = [];

    var isTribeFilterValid = filters.tribes.every(function(tribeId) {
      // Return failure if tribe id is invalid, otherwise add id to query array
      return mongoose.Types.ObjectId.isValid(tribeId) && tribeQueries.push({ 'user.member.tag': new mongoose.Types.ObjectId(tribeId) });
    });

    if (!isTribeFilterValid) {
      return res.status(400).send({
        message: errorHandler.getErrorMessageByKey('invalid-id')
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
  /**
   * Could return something like this here already (so no need to refactor at frontend):
   *
   * lat: marker.locationFuzzy[0],
   * lng: marker.locationFuzzy[1],
   * user: marker.user,
   * icon: $scope.icons[marker.status]
   */
  query.push({
    $project: {
      _id: '$_id',
      location: '$locationFuzzy',
      status: '$status'
      /*
      user: {
        _id: '$user._id',
        member: '$user.member'
      }
      */
    }
  });

  Offer.aggregate(query).exec(function(err, offers) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {

      res.json(offers);
    }
  });
};


/**
 * Show the current Offer
 */
exports.read = function(req, res) {
  res.json(req.offer || {});
};


// Offer reading middleware
exports.offerByUserId = function(req, res, next, userId) {

  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({
      message: errorHandler.getErrorMessageByKey('invalid-id')
    });
  }

  Offer.findOne({
    user: userId
  })
  .exec(function(err, offer) {

    // Errors
    if (err) return next(err);
    if (!offer) {
      return res.status(404).send({
        message: errorHandler.getErrorMessageByKey('not-found')
      });
    }

    // offer is a Mongo document, turn it into regular JS object
    // so that we can modify it on the fly
    offer = offer.toObject();

    // Sanitize each outgoing offer's contents
    offer.description = sanitizeHtml(offer.description, textProcessor.sanitizeOptions);
    offer.noOfferDescription = sanitizeHtml(offer.noOfferDescription, textProcessor.sanitizeOptions);

    // Make sure we return accurate location only for offer owner,
    // others will see pre generated fuzzy location
    if (userId !== req.user.id) {
      offer.location = offer.locationFuzzy;
    }

    // Pick fields to send out, leaves out e.g. `locationFuzzy` and `reactivateReminderSent`
    offer = _.pick(offer, publicOfferFields);

    req.offer = offer;

    next();
  });

};


// Offer reading middleware
exports.offerById = function(req, res, next, offerId) {

  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(offerId)) {
    return res.status(400).send({
      message: errorHandler.getErrorMessageByKey('invalid-id')
    });
  }

  // Require user
  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  async.waterfall([

    // Find offer
    function(done) {
      Offer.findById(offerId)
        .populate('user', userHandler.userListingProfileFields)
        .exec(function(err, offer) {

          // No offer
          if (err || !offer) {
            return res.status(404).send({
              message: errorHandler.getErrorMessageByKey('not-found')
            });
          }

          // offer is a Mongo document, turn it into regular JS object
          // so that we can modify it on the fly
          offer = offer.toObject();

          done(null, offer);
        });
    },

    // Populate `tag` fields from objects at `offer.user.member` array
    function(offer, done) {

      // Nothing to populate
      if (!offer.user.member && !offer.user.member.length) {
        return done(null, offer);
      }

      User.populate(offer.user, {
        path: 'member.tag',
        select: tribesHandler.tribeFields,
        model: 'Tag',
        options: { sort: { count: -1 } }
      }, function(err, user) {
        // Overwrite old `offer.user` with new `user` object
        // containing populated `member.tag` to `offer`
        offer.user = user;
        done(err, offer);
      });

    },

    // Sanitize and continue
    function(offer, done) {
      // Sanitize each outgoing offer's contents
      offer.description = sanitizeHtml(offer.description, textProcessor.sanitizeOptions);
      offer.noOfferDescription = sanitizeHtml(offer.noOfferDescription, textProcessor.sanitizeOptions);

      // Make sure we return accurate location only for offer owner,
      // others will see pre generated fuzzy location
      if (offer.user !== req.user.id) {
        offer.location = offer.locationFuzzy;
      }

      // Pick fields to send out, leaves out e.g. `locationFuzzy` and `reactivateReminderSent`
      offer = _.pick(offer, _.union(publicOfferFields, ['user']));

      req.offer = offer;

      done();
    }

  ], function(err) {
    return next(err);
  });

};
