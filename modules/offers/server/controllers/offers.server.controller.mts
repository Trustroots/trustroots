import userProfile from '../../../users/server/controllers/users.profile.server.controller.mjs';
import { readFileSync } from 'node:fs';
import _ from 'lodash';
import async from 'async';
import config from './../../../../config/config.mts';
import errorService from './../../../core/server/services/error.server.service.mjs';
import tribes from './../../../tribes/server/controllers/tribes.server.controller.mjs';
import textService from './../../../core/server/services/text.server.service.mjs';
import log from './../../../../config/lib/logger.mjs';
import sanitizeHtml from 'sanitize-html';
import moment from 'moment';
import mongoose, {
  type CallbackError,
  type PipelineStage,
  type Types,
} from 'mongoose';
import type {
  OfferType,
  OfferSearchAggregationFeature,
  OfferPayload,
} from '../../shared/offer.js';
import type {
  AuthenticatedOfferUser,
  OfferEndpointDocument,
  OfferEndpointRecord,
  OfferSanitiseRecord,
  OfferSanitisedPayload,
  PopulatedOfferUser,
  OfferNext,
  OfferRequest,
  OfferResponse,
  OfferSanitiseDocument,
  OfferReadDocument,
} from './offers.server.contracts.mts';
import normaliseOfferExpiry from './../services/offer-expiry.server.service.mjs';
import {
  prepareNewOfferInput,
  prepareOfferPayload,
  prepareOfferUpdateInput,
  prepareOfferMutationResponse,
  prepareOfferSearchResults,
} from './../services/offer-payload.server.service.mts';
function getUserProfile() {
  return userProfile;
}

/**
 * Module dependencies.
 */
const Offer = mongoose.model<OfferEndpointRecord>('Offer');
const User = mongoose.model<PopulatedOfferUser>('User');
const DEFAULT_MAP_LOCATION = [48.6908333333, 9.14055555556];

interface OfferFilters {
  hasArrayFilter(filterType: string): boolean;
  hasObjectFilter(filterType: string): boolean;
}

function addOfferFilterHelpers(filters: object): OfferFilters {
  return Object.assign(filters, {
    hasArrayFilter(filterType: string): boolean {
      const value = Reflect.get(filters, filterType);
      return (
        Object.hasOwn(filters, filterType) &&
        Array.isArray(value) &&
        value.length > 0
      );
    },
    hasObjectFilter(filterType: string): boolean {
      const value = Reflect.get(filters, filterType);
      return (
        Object.hasOwn(filters, filterType) &&
        _.isObject(value) &&
        Object.keys(value).length > 0
      );
    },
  });
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function normaliseEndpointExpiry(
  type: OfferType | undefined,
  validUntil: unknown,
): Date | undefined {
  return normaliseOfferExpiry(
    type,
    validUntil,
    config.limits.maxOfferValidFromNow,
    moment().toDate(),
  );
}

function isDefaultMapLocation(location: unknown): boolean {
  return (
    Array.isArray(location) &&
    location.length === 2 &&
    location[0] === DEFAULT_MAP_LOCATION[0] &&
    location[1] === DEFAULT_MAP_LOCATION[1]
  );
}

/**
 * Parse filters object from json string
 */
function parseFiltersString(
  filtersString: string,
): Record<string, unknown> | unknown[] | false {
  try {
    const filtersObject = JSON.parse(filtersString);

    // Handle non-exception-throwing cases:
    // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
    // but... JSON.parse(null) returns null, and typeof null === "object",
    // so we must check for that, too. Thankfully, null is falsey, so this suffices.
    // @link http://stackoverflow.com/a/20392392/1984644
    if (filtersObject !== null && typeof filtersObject === 'object') {
      if (Array.isArray(filtersObject)) return filtersObject;
      const filters: Record<string, unknown> = Object.create(null);
      for (const [key, value] of Object.entries(filtersObject)) {
        filters[key] = value;
      }
      return filters;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Sanitize offer fields
 */
function sanitizeOffer(
  offerDocument: OfferSanitiseDocument,
  authenticatedUser?: AuthenticatedOfferUser | null,
  alwaysFuzzyLocation = false,
): OfferSanitisedPayload {
  // offer is a Mongo document, turn it into regular JS object
  // so that we can modify it on the fly
  const offer: OfferSanitiseRecord = offerDocument.toObject();
  let responseLocation: OfferSanitiseRecord['location'] | undefined =
    offer.location;
  const ownerId = (offer.user as PopulatedOfferUser)._id || offer.user;
  const isOwnOffer =
    authenticatedUser &&
    authenticatedUser._id.equals(
      ownerId as Parameters<typeof authenticatedUser._id.equals>[0],
    );
  const authenticatedRoles = authenticatedUser?.roles || [];
  const hideContactDetails =
    !isOwnOffer &&
    authenticatedRoles.includes('shadowban') &&
    !authenticatedRoles.includes('admin');

  // Sanitize each outgoing offer's contents
  // Offers are already sanitized when they go into the database,
  // but this is more lightweight sanitization just in case we've changed
  // our sanitization settings since we stored this data. And just in case.
  if (offer.description !== undefined) {
    let description = sanitizeHtml(
      offer.description,
      textService.sanitizeOptions,
    );
    if (hideContactDetails) {
      description = textService.stripContactDetails(description);
    }
    offer.description = description;
  }
  if (offer.noOfferDescription !== undefined) {
    let noOfferDescription = sanitizeHtml(
      offer.noOfferDescription,
      textService.sanitizeOptions,
    );
    if (hideContactDetails) {
      noOfferDescription = textService.stripContactDetails(noOfferDescription);
    }
    offer.noOfferDescription = noOfferDescription;
  }

  // Make sure we return accurate location only for offer owner,
  // others will see pre generated fuzzy location
  if (alwaysFuzzyLocation || !isOwnOffer) {
    responseLocation = offer.locationFuzzy;
  }

  // Pick fields to send out, leaves out e.g. `locationFuzzy` and `reactivateReminderSent`
  return prepareOfferPayload({
    ...offer,
    location: responseLocation,
  } as unknown as OfferPayload<Types.ObjectId | string, Date>);
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
function isValidCoordinate(coordinate: unknown): boolean {
  const regexp = /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/;
  return (
    !_.isUndefined(coordinate) &&
    _.isFinite(parseFloat(String(coordinate))) &&
    regexp.test(String(coordinate))
  );
}

/**
 * Validate offer type
 *
 * @param {String} type - Offer type ("host" or "meet")
 * @returns {Boolean} true on success, false on failure.
 */
function isValidOfferType(type: unknown): type is OfferType {
  // Get list of valid offer types directly from Mongoose Schema
  const typePath = Offer.schema.path('type');
  const enumValues =
    (typePath as typeof typePath & { enumValues?: OfferType[] }).enumValues ||
    [];
  return enumValues.includes(type as OfferType);
}

/**
 * Create offer
 */
function create(
  req: OfferRequest<Record<string, unknown>>,
  res: OfferResponse,
) {
  if (!req.user) {
    return errorService.sendForbidden(res);
  }

  const body = req.body!;
  // Validate type
  if (!body.type || !isValidOfferType(body.type)) {
    return res.status(400).send({
      message: 'Missing or invalid offer type.',
    });
  }

  // Missing required fields
  if (!body.location) {
    return res.status(400).send({
      message: 'Missing offer location.',
    });
  }
  if (isDefaultMapLocation(body.location)) {
    return res.status(400).send({
      message: 'Choose a location for your offer.',
    });
  }

  const validUntil = normaliseEndpointExpiry(body.type, body.validUntil);
  if (validUntil === undefined) {
    delete body.validUntil;
  } else {
    body.validUntil = validUntil;
  }

  // Create new offer by filtering out what users can modify
  // When creating an offer, we allow type field
  // Preserve the original raw request boundary: Mongoose casts and validates
  // selected writable fields when constructing the document.
  const offer = new Offer(
    prepareNewOfferInput(body) as Partial<OfferEndpointRecord>,
  );
  offer.user = req.user._id;

  // Update timestamp
  offer.updated = new Date();
  offer.save().then(
    function () {
      res.json(prepareOfferMutationResponse('Offer saved.'));
    },
    function () {
      res.status(400).send({
        message: 'Failed to save offer.',
      });
    },
  );
}

/**
 * Update an Offer
 */
function update(
  req: OfferRequest<Record<string, unknown>>,
  res: OfferResponse,
) {
  const offer = req.offer! as OfferEndpointDocument;
  const owner = offer.user as PopulatedOfferUser;
  const body = req.body!;
  if (!req.user || !owner._id.equals(req.user._id)) {
    return errorService.sendForbidden(res);
  }
  async.waterfall(
    [
      // Validate
      function (done: (error?: Error | null) => void) {
        // User can modify only their own offers
        // Missing required fields
        if (!body.location) {
          return res.status(400).send({
            message: 'Missing offer location.',
          });
        }
        if (isDefaultMapLocation(body.location)) {
          return res.status(400).send({
            message: 'Choose a location for your offer.',
          });
        }

        // Attempting to change offer type yelds error
        if (body.type && body.type !== offer.type) {
          return res.status(400).send({
            message: 'You cannot update offer type.',
          });
        }
        done();
      },
      // Create offer object and modify it
      function (
        done: (error: Error | null, result?: OfferEndpointDocument) => void,
      ) {
        const validUntil = normaliseEndpointExpiry(offer.type, body.validUntil);
        if (validUntil === undefined) {
          delete body.validUntil;
        } else {
          body.validUntil = validUntil;
        }

        // Pick only fields user is allowed to modify
        // Extend offer in request (picked by `offerById` middleware earlier)
        const updatedOffer = _.extend(offer, prepareOfferUpdateInput(body));

        // Update timestamp
        updatedOffer.updated = new Date();

        // Reset reactivate reminders
        // Setting this to undefined will remove the field
        updatedOffer.set('reactivateReminderSent', undefined);
        done(null, updatedOffer);
      },
      // Save offer
      function (
        updatedOffer: OfferEndpointDocument,
        done: (error?: Error | null) => void,
      ) {
        updatedOffer.save().then(
          function () {
            done();
          },
          function (err: Error) {
            done(err);
          },
        );
      },
      // Done!
      function () {
        return res.json(prepareOfferMutationResponse('Offer updated.'));
      },
    ],
    function (err?: Error | null) {
      if (err) {
        return errorService.sendBadRequest(res, err);
      }
    },
  );
}

/**
 * Delete an Offer
 */
function deleteOffer(req: OfferRequest, res: OfferResponse) {
  const offer = req.offer! as OfferEndpointDocument;
  const owner = offer.user as PopulatedOfferUser;
  // User can remove only their own offers
  if (!req.user || !owner._id.equals(req.user._id)) {
    return errorService.sendForbidden(res);
  }
  Offer.findOneAndDelete({
    _id: offer._id,
    user: req.user._id,
  }).then(
    function () {
      res.json(prepareOfferMutationResponse('Offer removed.'));
    },
    function (err: CallbackError) {
      errorService.sendBadRequest(res, err);
    },
  );
}

/**
 * List of Offers
 */
function list(req: OfferRequest, res: OfferResponse) {
  if (!req.user) {
    return errorService.sendForbidden(res);
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
    let coordinate = _.get(req.query!, coordinateKey, false);

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
  let filters: OfferFilters = addOfferFilterHelpers({});
  const requestQuery = req.query!;
  if (requestQuery.filters) {
    const parsedFilters = parseFiltersString(String(requestQuery.filters));

    // Could not parse filters json string into object
    if (!parsedFilters) {
      return res.status(400).send({
        message: 'Could not parse filters.',
      });
    }
    filters = addOfferFilterHelpers(parsedFilters);
  }

  // Basic query has always bounding box
  const query: PipelineStage[] = [
    {
      $match: {
        locationFuzzy: {
          $geoWithin: {
            // Note:
            // http://docs.mongodb.org/manual/reference/operator/query/box
            // -> It's latitude first as in the database, not longitude first as in the documentation
            $box: [
              [
                parseFloat(String(requestQuery.southWestLat)),
                parseFloat(String(requestQuery.southWestLng)),
              ],
              [
                parseFloat(String(requestQuery.northEastLat)),
                parseFloat(String(requestQuery.northEastLng)),
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
        {
          status: 'yes',
        },
        {
          status: 'maybe',
        },
        {
          status: {
            $exists: false,
          },
        },
      ],
    },
  });

  // Don't return outdated offers
  query.push({
    $match: {
      $or: [
        {
          validUntil: {
            $gte: new Date(),
          },
        },
        {
          validUntil: {
            $exists: false,
          },
        },
      ],
    },
  });

  // Types filter
  const typesFilter = Reflect.get(filters, 'types');
  if (filters.hasArrayFilter('types') && isUnknownArray(typesFilter)) {
    // Accept only valid values, ignore the rest
    // @link https://lodash.com/docs/#filter
    const filterTypes = _.filter(typesFilter, function (type: unknown) {
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
      'user.roles': {
        $nin: ['suspended', 'shadowban'],
      },
    },
  });

  // Last seen filter
  if (filters.hasObjectFilter('seen')) {
    const seenFilter = Reflect.get(filters, 'seen');
    const seenDuration: Record<string, number> = {};
    for (const [unit, amount] of Object.entries(
      seenFilter as Record<string, unknown>,
    )) {
      seenDuration[unit] = Number(amount);
    }
    query.push({
      $match: {
        'user.seen': {
          $gte: moment().subtract(seenDuration).toDate(),
        },
      },
    });
  }

  // Languages filter
  if (
    filters.hasArrayFilter('languages') &&
    isUnknownArray(Reflect.get(filters, 'languages'))
  ) {
    const languageFilter = Reflect.get(filters, 'languages');
    let languages = JSON.parse(
      readFileSync(
        new URL('../../../../config/languages/languages.json', import.meta.url),
        'utf8',
      ),
    );

    // Above json `languages` object contains language names, but we need just keys.
    languages = _.keys(languages);

    // Accept only valid language codes, ignore the rest
    // @link https://lodash.com/docs/#filter
    const filterLanguages = _.filter(
      languageFilter,
      function (language: unknown) {
        return (
          typeof language === 'string' && _.indexOf(languages, language) > -1
        );
      },
    );

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
  if (
    filters.hasArrayFilter('tribes') &&
    isUnknownArray(Reflect.get(filters, 'tribes'))
  ) {
    const tribeFilter = Reflect.get(filters, 'tribes');
    const tribeQueries: Array<Record<string, Types.ObjectId>> = [];
    const isTribeFilterValid = tribeFilter.every(function (tribeId: unknown) {
      // Return failure if tribe id is invalid, otherwise add id to query array
      return (
        typeof tribeId === 'string' &&
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
  const showOnlyInMyCirclesQueries: Array<Record<string, unknown>> = [
    {
      showOnlyInMyCircles: false,
    },
  ];
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
        offer: {
          $concat: ['$type', '-', '$status'],
        },
      },
      geometry: {
        coordinates: '$locationFuzzy',
        type: 'Point',
      },
    },
  });
  Offer.aggregate<OfferSearchAggregationFeature<Types.ObjectId>>(query)
    .exec()
    .then(
      function (features) {
        res.json(prepareOfferSearchResults(features));
      },
      function (err) {
        // Log the failure
        log('error', 'Querying for offers caused an error. #g28fb1', {
          error: err,
        });
        return errorService.sendBadRequest(res, err);
      },
    );
}

/**
 * Return offers
 */
function listOffersByUser(req: OfferRequest, res: OfferResponse) {
  res.json(req.offers || []);
}

/**
 * Return an offer
 */
function getOffer(req: OfferRequest, res: OfferResponse) {
  async.waterfall(
    [
      function (
        done: (error?: Error | null, result?: OfferReadDocument) => void,
      ) {
        // Don't proceed if offer doesn't have user
        const loadedOffer = req.offer as OfferReadDocument | null | undefined;
        if (!loadedOffer || !loadedOffer.user || !loadedOffer.location) {
          return errorService.sendNotFound(res);
        }
        done(null, loadedOffer);
      },
      // Populate `tribe` fields from objects at `offer.user.member` array
      function (
        offer: OfferReadDocument,
        done: (error?: Error | null, result?: OfferReadDocument) => void,
      ) {
        // Nothing to populate
        const offerUser = offer.user as PopulatedOfferUser;
        if (!offerUser.member || offerUser.member.length === 0) {
          return done(null, offer);
        }
        User.populate(offer.user, tribes.tribePopulateOptions()).then(
          function (user) {
            // Overwrite old `offer.user` with new `user` object
            // containing populated `member.tribe` to `offer`
            offer.user = user;
            done(null, offer);
          },
          function (error: unknown) {
            done(error as Error);
          },
        );
      },
      function (offer: OfferReadDocument) {
        // Sanitize offer before returning it
        res.json(sanitizeOffer(offer, req.user ?? undefined));
      },
    ],
    function (err?: Error | null) {
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
}

// Offer reading middleware
function offersByUserId(
  req: OfferRequest,
  res: OfferResponse,
  next: OfferNext,
  userId: string | Types.ObjectId,
) {
  // Authenticated user required
  if (!req.user) {
    return errorService.sendForbidden(res);
  }

  // Validate userId is valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return errorService.sendInvalidId(res);
  }

  // Database query
  const query = {
    user: userId,
    $or: [
      {
        validUntil: {
          $gte: new Date(),
        },
      },
      {
        validUntil: {
          $exists: false,
        },
      },
    ],
  };

  // Validate optional type parameter
  const requestQuery = req.query!;
  if (_.has(requestQuery, 'types')) {
    // Get list of valid offer types directly from Mongoose Schema
    const typePath = Offer.schema.path('type');
    const enumValues = (typePath as typeof typePath & { enumValues?: string[] })
      .enumValues;
    const validOfferTypes = (enumValues || []).filter(
      (value): value is OfferType => isValidOfferType(value),
    );

    // Ensure we have array of type(s)
    // 3rd parameter sets max limit for array length,
    // ensuring users can't send insanely long arrays for our queries
    const queryTypes = _.split(
      String(requestQuery.types),
      ',',
      validOfferTypes.length,
    );
    queryTypes.forEach(function (paramType) {
      // Return failure if type is invalid, otherwise add type to query array
      if (paramType && isValidOfferType(paramType)) {
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
  Offer.find(query).then(
    function (offers: OfferEndpointDocument[]) {
      if (!offers || offers.length === 0) {
        return errorService.sendNotFound(res);
      }

      // Sanitize offers
      req.offers = _.map(offers, function (offer) {
        return sanitizeOffer(offer, req.user);
      });
      next();
    },
    function (err: CallbackError) {
      next(err);
    },
  );
}

// Offer reading middleware
function offerById(
  req: OfferRequest,
  res: OfferResponse,
  next: OfferNext,
  offerId: string,
) {
  // Require user
  if (!req.user) {
    return errorService.sendForbidden(res);
  }

  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(offerId)) {
    return errorService.sendInvalidId(res);
  }
  Offer.findById(offerId)
    .populate('user', getUserProfile().userListingProfileFields)
    .exec()
    .then(
      function (offer: OfferEndpointDocument | null) {
        if (!offer) {
          return errorService.sendNotFound(res);
        }
        req.offer = offer as OfferReadDocument;
        return next();
      },
      function (err: CallbackError) {
        log('error', 'Getting offer by id caused an error. #2kg3g3', {
          error: err,
        });
        return errorService.sendNotFound(res);
      },
    );
}

/**
 * Clear all offers by user id
 */
function removeAllByUserId(
  userId: Types.ObjectId | string,
  callback?: (error: Error | null) => void,
) {
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
}
const service = {
  create,
  delete: deleteOffer,
  getOffer,
  list,
  listOffersByUser,
  offerById,
  offersByUserId,
  removeAllByUserId,
  update,
};
export {
  create,
  deleteOffer as delete,
  getOffer,
  list,
  listOffersByUser,
  offerById,
  offersByUserId,
  removeAllByUserId,
  update,
};
export default service;
export { service as 'module.exports' };
