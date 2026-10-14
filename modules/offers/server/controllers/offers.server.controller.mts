import userProfile from '../../../users/server/controllers/users.profile.server.controller.mjs';
import { readFileSync } from 'node:fs';
import _ from 'lodash';
import async from 'async';
import config from './../../../../config/config.mjs';
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
  OfferPayload,
  OfferSearchAggregationFeature,
  CreateOfferRequest,
  UpdateOfferRequest,
} from '../../shared/offer.js';
import type {
  AuthenticatedOfferUser,
  OfferEndpointDocument,
  OfferEndpointRecord,
  OfferSanitiseRecord,
  PopulatedOfferUser,
  OfferNext,
  OfferRequest,
  OfferRequestDocument,
  OfferResponse,
  OfferReadDocument,
  ValidOfferEndpointDocument,
} from './offers.server.contracts.mts';
import normaliseOfferExpiry from './../services/offer-expiry.server.service.mjs';
import {
  prepareNewOffer,
  prepareOfferMutationResponse,
  prepareOfferPayload,
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

interface OfferFilters extends Record<string, unknown> {
  hasArrayFilter(filterType: string): boolean;
  hasObjectFilter(filterType: string): boolean;
}

function addOfferFilterHelpers(filters: Record<string, unknown>): OfferFilters {
  return Object.assign(filters, {
    hasArrayFilter(filterType: string): boolean {
      const value = filters[filterType];
      return (
        Object.hasOwn(filters, filterType) &&
        Array.isArray(value) &&
        value.length > 0
      );
    },
    hasObjectFilter(filterType: string): boolean {
      const value = filters[filterType];
      return (
        Object.hasOwn(filters, filterType) &&
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value).length > 0
      );
    },
  });
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function requestOfferUserId(
  user: unknown,
): Types.ObjectId | string | undefined {
  if (user instanceof mongoose.Types.ObjectId) return user;
  if (typeof user === 'string') return user;
  if (
    typeof user === 'object' &&
    user !== null &&
    '_id' in user &&
    user._id instanceof mongoose.Types.ObjectId
  ) {
    return user._id;
  }
  return undefined;
}

function isOfferEndpointDocument(
  value: OfferRequestDocument,
): value is ValidOfferEndpointDocument {
  return (
    typeof value.set === 'function' &&
    typeof value.save === 'function' &&
    isOfferReadDocument(value)
  );
}

function isOfferReadDocument(
  value: OfferRequestDocument,
): value is OfferReadDocument {
  return (
    Boolean(value.user) &&
    Boolean(value.location) &&
    typeof value.toObject === 'function'
  );
}

function normaliseEndpointExpiry(
  type: OfferType,
  validUntil: string | number | Date | undefined,
): Date | undefined {
  const expiry =
    validUntil === undefined
      ? undefined
      : validUntil instanceof Date
        ? validUntil
        : String(validUntil);
  return normaliseOfferExpiry(
    type,
    expiry ?? '',
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
): Record<string, unknown> | false {
  try {
    const filtersObject = JSON.parse(filtersString);

    // Handle non-exception-throwing cases:
    // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
    // but... JSON.parse(null) returns null, and typeof null === "object",
    // so we must check for that, too. Thankfully, null is falsey, so this suffices.
    // @link http://stackoverflow.com/a/20392392/1984644
    if (
      filtersObject !== null &&
      typeof filtersObject === 'object' &&
      !Array.isArray(filtersObject)
    ) {
      const filters: Record<string, unknown> = {};
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
  offerDocument: OfferReadDocument,
  authenticatedUser?: AuthenticatedOfferUser,
  alwaysFuzzyLocation = false,
): OfferPayload<Types.ObjectId | string, Date> {
  // offer is a Mongo document, turn it into regular JS object
  // so that we can modify it on the fly
  const offer: OfferSanitiseRecord = offerDocument.toObject();
  const ownerId = requestOfferUserId(offer.user);
  const isOwnOffer = Boolean(
    authenticatedUser &&
    ownerId &&
    authenticatedUser._id.toString() === ownerId.toString(),
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
    offer.location = offer.locationFuzzy;
  }

  // Pick fields to send out, leaves out e.g. `locationFuzzy` and `reactivateReminderSent`
  if (!offer.type || !offer.user || !isOfferLocation(offer.location)) {
    throw new Error('Offer is missing required response fields.');
  }
  if (
    !(offer.user instanceof mongoose.Types.ObjectId) &&
    typeof offer.user !== 'string' &&
    typeof offer.user.username !== 'string'
  ) {
    throw new Error('Offer owner is missing required response fields.');
  }
  return prepareOfferPayload({
    ...offer,
    type: offer.type,
    user: offer.user,
    location: offer.location,
  });
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
  const enumValues = 'enumValues' in typePath ? typePath.enumValues : undefined;
  return Array.isArray(enumValues) && enumValues.some(value => value === type);
}

function isOfferLocation(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  );
}

function parseOfferLocation(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const coordinates = value.map(coordinate => {
    if (typeof coordinate !== 'number' && typeof coordinate !== 'string')
      return undefined;
    const parsed = Number(coordinate);
    return Number.isFinite(parsed) ? parsed : undefined;
  });
  if (
    typeof coordinates[0] !== 'number' ||
    typeof coordinates[1] !== 'number'
  ) {
    return undefined;
  }
  return [coordinates[0], coordinates[1]];
}

function hasOwnField(body: Record<string, unknown>, field: string): boolean {
  return Object.hasOwn(body, field);
}

function isOfferExpiry(value: unknown): value is string | number | Date {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    value instanceof Date
  );
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

  const body = req.body ?? {};
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

  const createRequest: CreateOfferRequest = {
    type: body.type,
    location: parseOfferLocation(body.location) ?? [0, 0],
  };
  const validUntil = normaliseEndpointExpiry(
    body.type,
    isOfferExpiry(body.validUntil) ? body.validUntil : undefined,
  );
  if (validUntil === undefined) {
    delete body.validUntil;
  } else {
    body.validUntil = validUntil;
  }

  // Create new offer by filtering out what users can modify
  // When creating an offer, we allow type field
  const offer = new Offer(prepareNewOffer(createRequest));
  for (const field of [
    'status',
    'description',
    'noOfferDescription',
    'maxGuests',
    'showOnlyInMyCircles',
  ]) {
    if (hasOwnField(body, field)) offer.set(field, body[field]);
  }
  if (!parseOfferLocation(body.location)) offer.set('location', body.location);
  if (validUntil !== undefined) offer.set('validUntil', validUntil);
  offer.user = req.user._id;

  // Update timestamp
  offer.updated = new Date();
  offer.save(function (err) {
    if (err) {
      return res.status(400).send({
        message: 'Failed to save offer.',
      });
    }
    res.json(prepareOfferMutationResponse('Offer saved.'));
  });
}

/**
 * Update an Offer
 */
function update(
  req: OfferRequest<Record<string, unknown>>,
  res: OfferResponse,
) {
  const offer = req.offer;
  const ownerId = offer ? requestOfferUserId(offer.user) : undefined;
  const body = req.body ?? {};
  if (
    !req.user ||
    !offer ||
    !ownerId ||
    ownerId.toString() !== req.user._id.toString()
  ) {
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
        if (!isOfferEndpointDocument(offer)) {
          return done(new Error('Offer document is not available for update.'));
        }
        const offerType = offer.type;
        if (!isValidOfferType(offerType)) {
          return done(new Error('Offer type is not available for update.'));
        }
        const validUntil = normaliseEndpointExpiry(
          offerType,
          isOfferExpiry(body.validUntil) ? body.validUntil : undefined,
        );
        if (validUntil === undefined) {
          delete body.validUntil;
        } else {
          body.validUntil = validUntil;
        }

        // Pick only fields user is allowed to modify
        const offerModifications: UpdateOfferRequest = {};
        const parsedLocation = parseOfferLocation(body.location);
        if (body.location !== undefined && parsedLocation)
          offerModifications.location = parsedLocation;
        if (
          body.status === 'yes' ||
          body.status === 'maybe' ||
          body.status === 'no'
        )
          offerModifications.status = body.status;
        if (typeof body.description === 'string')
          offerModifications.description = body.description;
        if (typeof body.noOfferDescription === 'string')
          offerModifications.noOfferDescription = body.noOfferDescription;
        if (typeof body.maxGuests === 'number')
          offerModifications.maxGuests = body.maxGuests;
        if (validUntil !== undefined)
          offerModifications.validUntil = validUntil;
        if (typeof body.showOnlyInMyCircles === 'boolean')
          offerModifications.showOnlyInMyCircles = body.showOnlyInMyCircles;

        // Extend offer in request (picked by `offerById` middleware earlier)
        const updatedOffer = _.extend(offer, offerModifications);
        const typedFields = new Set(Object.keys(offerModifications));
        for (const field of [
          'status',
          'description',
          'noOfferDescription',
          'maxGuests',
          'location',
          'showOnlyInMyCircles',
        ]) {
          if (hasOwnField(body, field) && !typedFields.has(field)) {
            updatedOffer.set(field, body[field]);
          }
        }

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
        updatedOffer.save(function (err) {
          done(err);
        });
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
  const offer = req.offer;
  const ownerId = offer ? requestOfferUserId(offer.user) : undefined;
  // User can remove only their own offers
  if (
    !req.user ||
    !offer ||
    !ownerId ||
    ownerId.toString() !== req.user._id.toString()
  ) {
    return errorService.sendForbidden(res);
  }
  Offer.findOneAndRemove(
    {
      _id: offer._id,
      user: req.user._id,
    },
    function (err: CallbackError) {
      if (err) {
        return errorService.sendBadRequest(res, err);
      }
      res.json(prepareOfferMutationResponse('Offer removed.'));
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
    let coordinate = _.get(req.query ?? {}, coordinateKey, false);

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
  const requestQuery = req.query ?? {};
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
  if (filters.hasArrayFilter('types') && isUnknownArray(filters.types)) {
    // Accept only valid values, ignore the rest
    // @link https://lodash.com/docs/#filter
    const filterTypes = _.filter(filters.types, function (type: unknown) {
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
    const seenFilter = filters.seen;
    const seenDuration =
      seenFilter !== null && typeof seenFilter === 'object'
        ? Object.fromEntries(
            Object.entries(seenFilter).filter(
              (entry): entry is [string, number] =>
                typeof entry[1] === 'number',
            ),
          )
        : String(seenFilter);
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
    isUnknownArray(filters.languages)
  ) {
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
      filters.languages,
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
  if (filters.hasArrayFilter('tribes') && isUnknownArray(filters.tribes)) {
    const tribeQueries: Array<Record<string, Types.ObjectId>> = [];
    const isTribeFilterValid = filters.tribes.every(function (
      tribeId: unknown,
    ) {
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
        if (
          !req.offer ||
          !req.offer.user ||
          !req.offer.location ||
          !isOfferReadDocument(req.offer)
        ) {
          return errorService.sendNotFound(res);
        }
        done(null, req.offer);
      },
      // Populate `tribe` fields from objects at `offer.user.member` array
      function (
        offer: OfferReadDocument,
        done: (error?: Error | null, result?: OfferReadDocument) => void,
      ) {
        if (!offer.user) return errorService.sendNotFound(res);
        // Nothing to populate
        if (
          offer.user instanceof mongoose.Types.ObjectId ||
          typeof offer.user === 'string' ||
          !offer.user.member ||
          offer.user.member.length === 0
        ) {
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
            done(error instanceof Error ? error : new Error(String(error)));
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
  userId: string,
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
  const requestQuery = req.query ?? {};
  if (_.has(requestQuery, 'types')) {
    // Get list of valid offer types directly from Mongoose Schema
    const typePath = Offer.schema.path('type');
    const enumValues =
      'enumValues' in typePath && Array.isArray(typePath.enumValues)
        ? typePath.enumValues
        : [];
    const validOfferTypes = enumValues.filter((value): value is OfferType =>
      isValidOfferType(value),
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
  Offer.find(
    query,
    function (err: CallbackError, offers: OfferEndpointDocument[] | null) {
      // Errors
      if (err) {
        return next(err);
      }
      if (!offers || offers.length === 0) {
        return errorService.sendNotFound(res);
      }

      // Sanitize offers
      req.offers = _.map(offers, function (offer) {
        if (!isOfferReadDocument(offer)) {
          throw new Error(
            'Offer document is missing required response fields.',
          );
        }
        return sanitizeOffer(offer, req.user ?? undefined);
      });
      next();
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
  async.waterfall(
    [
      // Find offer
      function (
        done: (error?: Error | null, result?: OfferEndpointDocument) => void,
      ) {
        Offer.findById(offerId)
          .populate('user', getUserProfile().userListingProfileFields)
          .exec(function (
            err: CallbackError,
            offer: OfferEndpointDocument | null,
          ) {
            // No offer
            if (err) {
              log('error', 'Getting offer by id caused an error. #2kg3g3', {
                error: err,
              });
            }
            if (err || !offer) {
              return errorService.sendNotFound(res);
            }
            done(null, offer);
          });
      },
      // Continue
      function (
        offer: OfferReadDocument,
        done: (error?: Error | null) => void,
      ) {
        req.offer = offer;
        done();
      },
    ],
    function (err?: Error | null) {
      if (err) {
        log('error', 'Getting offer by id caused an error. #g34gj3', {
          error: err,
        });
      }
      return next(err);
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
