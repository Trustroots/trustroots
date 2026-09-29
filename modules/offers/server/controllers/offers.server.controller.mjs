import { createRequire } from 'module';
import _ from 'lodash';
import async from 'async';
import config from '../../../../config/config.js';
import errorService from '../../../core/server/services/error.server.service.js';
import tribes from '../../../tribes/server/controllers/tribes.server.controller.js';
import textService from '../../../core/server/services/text.server.service.js';
import log from '../../../../config/lib/logger.js';
import sanitizeHtml from 'sanitize-html';
import moment from 'moment';
import mongoose from 'mongoose';
import normaliseOfferExpiry from '../services/offer-expiry.server.service.js';
const require = createRequire(import.meta.url);

const service = {};

function getUserProfile() {
  return require('../../../users/server/controllers/users.profile.server.controller.js');
}

/**
 * Module dependencies.
 */
const Offer = mongoose.model('Offer');
const User = mongoose.model('User');

// Selected fields to return publicly for offers
const publicOfferFields = [
  '_id',
  'type',
  'status',
  'user',
  'description',
  'noOfferDescription',
  'maxGuests',
  'location',
  'updated',
  'validUntil',
  'showOnlyInMyCircles',
];

// Offer fields users can modify
const allowedOfferFields = [
  'status',
  'description',
  'noOfferDescription',
  'maxGuests',
  'location',
  'validUntil',
  'showOnlyInMyCircles',
];

/**
 * Parse filters object from json string
 */
function parseFiltersString(filtersString) {
  try {
    const filtersObject = JSON.parse(filtersString);

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
function sanitizeOffer(offer, authenticatedUser, alwaysFuzzyLocation) {
  // offer is a Mongo document, turn it into regular JS object
  // so that we can modify it on the fly
  offer = offer.toObject();

  const offerUserId = offer.user._id || offer.user;
  const isOwnOffer =
    authenticatedUser && authenticatedUser._id.equals(offerUserId);
  const authenticatedRoles = authenticatedUser?.roles || [];
  const hideContactDetails =
    !isOwnOffer &&
    authenticatedRoles.includes('shadowban') &&
    !authenticatedRoles.includes('admin');

  // Sanitize each outgoing offer's contents
  // Offers are already sanitized when they go into the database,
  // but this is more lightweight sanitization just in case we've changed
  // our sanitization settings since we stored this data. And just in case.
  if (!_.isUndefined(offer.description)) {
    offer.description = sanitizeHtml(
      offer.description,
      textService.sanitizeOptions,
    );
    if (hideContactDetails) {
      offer.description = textService.stripContactDetails(offer.description);
    }
  }
  if (!_.isUndefined(offer.noOfferDescription)) {
    offer.noOfferDescription = sanitizeHtml(
      offer.noOfferDescription,
      textService.sanitizeOptions,
    );
    if (hideContactDetails) {
      offer.noOfferDescription = textService.stripContactDetails(
        offer.noOfferDescription,
      );
    }
  }

  // Make sure we return accurate location only for offer owner,
  // others will see pre generated fuzzy location
  if (
    alwaysFuzzyLocation ||
    !authenticatedUser ||
    !authenticatedUser._id.equals(offerUserId)
  ) {
    offer.location = offer.locationFuzzy;
  }

  // Pick fields to send out, leaves out e.g. `locationFuzzy` and `reactivateReminderSent`
  offer = _.pick(offer, publicOfferFields);

  return offer;
}

/**
 * Validate latitude/longitude coordinates
 *
 * Tests for float, but doesn't care about valid lat/lon ranges
 *
 * Valid:
 * 150
 * 14.1
 * +3.4
 * -3.4
 * 10000
 *
 * Invalid:
 * 14.
 * 12foo
 * 12,2
 * 3.33.33
 *
 * @param {Float} coordinate - Expects latitude or longitude coordinate
 * @returns {Boolean} true on success, false on failure.
 */
function isValidCoordinate(coordinate) {
  const regexp = /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/;

  return (
    !_.isUndefined(coordinate) &&
    _.isFinite(parseFloat(coordinate)) &&
    regexp.test(coordinate)
  );
}

/**
 * Validate offer type
 *
 * @param {String} type - Offer type ("host" or "meet")
 * @returns {Boolean} true on success, false on failure.
 */
function isValidOfferType(type) {
  // Get list of valid offer types directly from Mongoose Schema
  const validOfferTypes = Offer.schema.path('type').enumValues || [];

  return type && validOfferTypes.indexOf(type) > -1;
}

/**
 * Create offer
 */
service.create = function (req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Validate type
  if (!req.body.type || !isValidOfferType(req.body.type)) {
    return res.status(400).send({
      message: 'Missing or invalid offer type.',
    });
  }

  // Missing required fields
  if (!req.body.location) {
    return res.status(400).send({
      message: 'Missing offer location.',
    });
  }

  const validUntil = normaliseOfferExpiry(
    req.body.type,
    req.body.validUntil,
    config.limits.maxOfferValidFromNow,
    moment(),
  );
  if (validUntil === undefined) {
    delete req.body.validUntil;
  } else {
    req.body.validUntil = validUntil;
  }

  // Create new offer by filtering out what users can modify
  // When creating an offer, we allow type field
  const offer = new Offer(
    _.pick(req.body, _.concat(allowedOfferFields, 'type')),
  );

  offer.user = req.user._id;

  // Update timestamp
  offer.updated = new Date();

  offer.save(function (err) {
    if (err) {
      return res.status(400).send({
        message: 'Failed to save offer.',
      });
    }

    res.json({
      message: 'Offer saved.',
    });
  });
};

/**
 * Update an Offer
 */
service.update = function (req, res) {
  async.waterfall(
    [
      // Validate
      function (done) {
        // User can modify only their own offers
        if (!req.user || !req.offer.user._id.equals(req.user._id)) {
          return res.status(403).send({
            message: errorService.getErrorMessageByKey('forbidden'),
          });
        }

        // Missing required fields
        if (!req.body.location) {
          return res.status(400).send({
            message: 'Missing offer location.',
          });
        }

        // Attempting to change offer type yelds error
        if (req.body.type && req.body.type !== req.offer.type) {
          return res.status(400).send({
            message: 'You cannot update offer type.',
          });
        }

        done();
      },

      // Create offer object and modify it
      function (done) {
        const validUntil = normaliseOfferExpiry(
          req.offer.type,
          req.body.validUntil,
          config.limits.maxOfferValidFromNow,
          moment(),
        );
        if (validUntil === undefined) {
          delete req.body.validUntil;
        } else {
          req.body.validUntil = validUntil;
        }

        // Pick only fields user is allowed to modify
        const offerModifications = _.pick(req.body, allowedOfferFields);

        // Extend offer in request (picked by `offerById` middleware earlier)
        const offer = _.extend(req.offer, offerModifications);

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
          message: 'Offer updated.',
        });
      },
    ],
    function (err) {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
    },
  );
};

/**
 * Delete an Offer
 */
service.delete = function (req, res) {
  // User can remove only their own offers
  if (!req.user || !req.offer.user._id.equals(req.user._id)) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  Offer.findOneAndRemove(
    {
      _id: req.offer._id,
      user: req.user._id,
    },
    function (err) {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }

      res.json({
        message: 'Offer removed.',
      });
    },
  );
};

/**
 * List of Offers
 */
service.list = function (req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Validate required bounding box query parameters
  const coordinateKeys = [
    'southWestLat',
    'southWestLng',
    'northEastLat',
    'northEastLng',
  ];
  const isCoordinatesValid = _.every(coordinateKeys, function (coordinateKey) {
    // Get query string from query
    // If there is no query string (`req.query`), it is the empty object, `{}`.
    let coordinate = _.get(req.query, coordinateKey, false);

    // Trim string coordinates
    // This is because when using `+` in front of a coordinate,
    // it'll translate to empty space which would fail validation
    // Before querying database, we'll anyway turn coordinate into Float
    if (typeof coordinate === 'string') {
      coordinate = coordinate.trim();
    }

    // Validate
    return isValidCoordinate(coordinate);
  });

  // Stop if any found invalid coordinate
  if (!isCoordinatesValid) {
    return res.status(400).send({
      message:
        'Invalid or missing coordinate. ' +
        'Required coordinates: ' +
        coordinateKeys.join(', ') +
        '.',
    });
  }

  // Parse filters
  let filters = {};
  if (req.query.filters) {
    filters = parseFiltersString(req.query.filters);

    // Could not parse filters json string into object
    if (!filters) {
      return res.status(400).send({
        message: 'Could not parse filters.',
      });
    }
  }

  filters.hasArrayFilter = function (filterType) {
    return (
      _.has(this, filterType) &&
      _.isArray(this[filterType]) &&
      this[filterType].length > 0
    );
  };

  filters.hasObjectFilter = function (filterType) {
    return (
      _.has(this, filterType) &&
      _.isPlainObject(this[filterType]) &&
      !_.isEmpty(this[filterType])
    );
  };

  // Basic query has always bounding box
  const query = [
    {
      $match: {
        locationFuzzy: {
          $geoWithin: {
            // Note:
            // http://docs.mongodb.org/manual/reference/operator/query/box
            // -> It's latitude first as in the database, not longitude first as in the documentation
            $box: [
              [
                parseFloat(req.query.southWestLat),
                parseFloat(req.query.southWestLng),
              ],
              [
                parseFloat(req.query.northEastLat),
                parseFloat(req.query.northEastLng),
              ],
            ],
          },
        },
      },
    },
  ];

  // Status filter
  // Note that `type:meet` are currently all `status:yes`
  query.push({
    $match: {
      $or: [
        { status: 'yes' },
        { status: 'maybe' },
        { status: { $exists: false } },
      ],
    },
  });

  // Don't return outdated offers
  query.push({
    $match: {
      $or: [
        { validUntil: { $gte: new Date() } },
        { validUntil: { $exists: false } },
      ],
    },
  });

  // Types filter
  if (filters.hasArrayFilter('types')) {
    // Accept only valid values, ignore the rest
    // @link https://lodash.com/docs/#filter
    const filterTypes = _.filter(filters.types, function (type) {
      return isValidOfferType(type);
    });

    // If we still have types left, apply the filter
    if (filterTypes.length) {
      query.push({
        $match: {
          type: {
            $in: filterTypes,
          },
        },
      });
    }
  }

  // Some of the filters are based on `user` schema
  query.push({
    $lookup: {
      from: 'users',
      localField: 'user',
      foreignField: '_id',
      as: 'user',
    },
  });
  // Because above `$lookup` returns an array with one user
  // `[{userObject}]`, we have to unwind it back to `{userObject}`
  // Preserve the entry in case the user mapping fails.
  query.push({
    $unwind: {
      path: '$user',
      preserveNullAndEmptyArrays: true,
    },
  });

  // Check for suspended and shadowbanned users
  query.push({
    $match: {
      // We could simply do this as performance improvement, but shadowbanned users are "public".
      'user.public': true,
      'user.roles': { $nin: ['suspended', 'shadowban'] },
    },
  });

  // Last seen filter
  if (filters.hasObjectFilter('seen')) {
    query.push({
      $match: {
        'user.seen': {
          $gte: moment().subtract(filters.seen).toDate(),
        },
      },
    });
  }

  // Languages filter
  if (filters.hasArrayFilter('languages')) {
    let languages = require('../../../../config/languages/languages.json');

    // Above json `languages` object contains language names, but we need just keys.
    languages = _.keys(languages);

    // Accept only valid language codes, ignore the rest
    // @link https://lodash.com/docs/#filter
    const filterLanguages = _.filter(filters.languages, function (language) {
      return _.indexOf(languages, language) > -1;
    });

    // If we still have languages left, apply the filter
    if (filterLanguages.length > 0) {
      query.push({
        $match: {
          'user.languages': {
            $in: filterLanguages,
          },
        },
      });
    }
  }

  // Tribes filter
  if (filters.hasArrayFilter('tribes')) {
    const tribeQueries = [];

    const isTribeFilterValid = filters.tribes.every(function (tribeId) {
      // Return failure if tribe id is invalid, otherwise add id to query array
      return (
        mongoose.Types.ObjectId.isValid(tribeId) &&
        tribeQueries.push({
          'user.member.tribe': new mongoose.Types.ObjectId(tribeId),
        })
      );
    });

    if (!isTribeFilterValid) {
      return res.status(400).send({
        message: errorService.getErrorMessageByKey('invalid-id'),
      });
    }

    // Build the query
    if (tribeQueries.length > 1) {
      // Match multible tribes
      query.push({
        $match: {
          $or: tribeQueries,
        },
      });
    } else {
      // Just one tribe
      query.push({
        $match: tribeQueries[0],
      });
    }
  }

  // Filter out users that do not share any circles with the authenticated user
  // and chose to not appear in those searches.
  const showOnlyInMyCirclesQueries = [{ showOnlyInMyCircles: false }];
  req.user.member?.forEach(function (membership) {
    // Add all the circles that the authenticated user is member of. One of them
    // must match for an offer to appear in the search result.
    showOnlyInMyCirclesQueries.push({
      'user.member.tribe': membership.tribe._id,
    });
  });
  query.push({
    $match: {
      $or: showOnlyInMyCirclesQueries,
    },
  });

  // Pick fields and convert to GeoJson Feature
  query.push({
    $project: {
      _id: 0,
      type: 'Feature',
      properties: {
        id: '$_id',
        status: '$status',
        type: '$type',
        offer: { $concat: ['$type', '-', '$status'] },
      },
      geometry: {
        coordinates: '$locationFuzzy',
        type: 'Point',
      },
    },
  });

  Offer.aggregate(query)
    .exec()
    .then(
      function (features) {
        // @TODO :-(
        const reversedFeatures = features.map(feature => {
          feature.geometry.coordinates = [
            feature.geometry.coordinates[1],
            feature.geometry.coordinates[0],
          ];
          return feature;
        });

        // Geojson
        res.json({
          features: reversedFeatures,
          type: 'FeatureCollection',
        });
      },
      function (err) {
        // Log the failure
        log('error', 'Querying for offers caused an error. #g28fb1', {
          error: err,
        });
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      },
    );
};

/**
 * Return offers
 */
service.listOffersByUser = function (req, res) {
  res.json(req.offers || []);
};

/**
 * Return an offer
 */
service.getOffer = function (req, res) {
  async.waterfall(
    [
      function (done) {
        // Don't proceed if offer doesn't have user
        if (!req.offer || !req.offer.user || !req.offer.location) {
          return res.status(404).send({
            message: errorService.getErrorMessageByKey('not-found'),
          });
        }

        done(null, req.offer);
      },

      // Populate `tribe` fields from objects at `offer.user.member` array
      function (offer, done) {
        // Nothing to populate
        if (!offer.user.member || offer.user.member.length === 0) {
          return done(null, offer);
        }

        User.populate(
          offer.user,
          {
            path: 'member.tribe',
            select: tribes.tribeFields,
            model: 'Tribe',
            // Not possible at the moment due bug in Mongoose
            // http://mongoosejs.com/docs/faq.html#populate_sort_order
            // https://github.com/Automattic/mongoose/issues/2202
            // options: { sort: { count: -1 } }
          },
          function (err, user) {
            // Overwrite old `offer.user` with new `user` object
            // containing populated `member.tribe` to `offer`
            offer.user = user;
            done(err, offer);
          },
        );
      },

      function (offer) {
        // Sanitize offer before returning it
        offer = sanitizeOffer(offer, req.user);

        res.json(offer);
      },
    ],
    function (err) {
      if (err) {
        // Something's wrong and we weren't prepared for itx
        log('error', 'Failed to load offer. #g34gss', {
          error: err,
        });
        return res.status(400).send({
          message: errorService.getErrorMessageByKey('default'),
        });
      }
    },
  );
};

// Offer reading middleware
service.offersByUserId = function (req, res, next, userId) {
  // Authenticated user required
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Validate userId is valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  // Database query
  const query = {
    user: userId,
    $or: [
      { validUntil: { $gte: new Date() } },
      { validUntil: { $exists: false } },
    ],
  };

  // Validate optional type parameter
  if (_.has(req.query, 'types')) {
    // Get list of valid offer types directly from Mongoose Schema
    const validOfferTypes = Offer.schema.path('type').enumValues;

    // Ensure we have array of type(s)
    // 3rd parameter sets max limit for array length,
    // ensuring users can't send insanely long arrays for our queries
    const queryTypes = _.split(req.query.types, ',', validOfferTypes.length);

    queryTypes.forEach(function (paramType) {
      // Return failure if type is invalid, otherwise add type to query array
      if (paramType && validOfferTypes.indexOf(paramType) > -1) {
        // Returns array length if other types exist already in db query,
        // otherwise returns `0`
        const i = (_.get(query, 'type.$in') || []).length;
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
      }
    });
  }

  // Get offers
  Offer.find(query, function (err, offers) {
    // Errors
    if (err) {
      return next(err);
    }

    if (!offers || offers.length === 0) {
      return res.status(404).send({
        message: errorService.getErrorMessageByKey('not-found'),
      });
    }

    // Sanitize offers
    req.offers = _.map(offers, function (offer) {
      return sanitizeOffer(offer, req.user);
    });

    next();
  });
};

// Offer reading middleware
service.offerById = function (req, res, next, offerId) {
  // Require user
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(offerId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  async.waterfall(
    [
      // Find offer
      function (done) {
        Offer.findById(offerId)
          .populate('user', getUserProfile().userListingProfileFields)
          .exec(function (err, offer) {
            // No offer
            if (err) {
              log('error', 'Getting offer by id caused an error. #2kg3g3', {
                error: err,
              });
            }

            if (err || !offer) {
              return res.status(404).send({
                message: errorService.getErrorMessageByKey('not-found'),
              });
            }

            done(null, offer);
          });
      },

      // Continue
      function (offer, done) {
        req.offer = offer;

        done();
      },
    ],
    function (err) {
      if (err) {
        log('error', 'Getting offer by id caused an error. #g34gj3', {
          error: err,
        });
      }
      return next(err);
    },
  );
};

/**
 * Clear all offers by user id
 */
service.removeAllByUserId = function (userId, callback) {
  Offer.deleteMany(
    {
      user: userId,
    },
    function (err) {
      if (callback) {
        callback(err);
      }
    },
  );
};

const create = service.create;
const deleteExport = service.delete;
const getOffer = service.getOffer;
const list = service.list;
const listOffersByUser = service.listOffersByUser;
const offerById = service.offerById;
const offersByUserId = service.offersByUserId;
const removeAllByUserId = service.removeAllByUserId;
const update = service.update;
export {
  create as create,
  deleteExport as delete,
  getOffer as getOffer,
  list as list,
  listOffersByUser as listOffersByUser,
  offerById as offerById,
  offersByUserId as offersByUserId,
  removeAllByUserId as removeAllByUserId,
  update as update,
};
export default service;
