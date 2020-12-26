const mongoose = require('mongoose');
const _ = require('lodash');
const path = require('path');
const util = require('util');
const config = require(path.resolve('./config/config'));
const textService = require(path.resolve(
  './modules/core/server/services/text.server.service',
));
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));
const emailService = require(path.resolve(
  './modules/core/server/services/email.server.service',
));
const pushService = require(path.resolve(
  './modules/core/server/services/push.server.service',
));
const userProfile = require(path.resolve(
  './modules/users/server/controllers/users.profile.server.controller',
));
const Reference = mongoose.model('Reference');
const User = mongoose.model('User');

/**
 * Validate the request body and data consistency
 * of Create a reference
 */
function validateCreate(req) {
  let valid = true;
  const details = {};
  const interactionErrors = {};

  // Can't create a reference to oneself
  if (req.user._id.equals(req.body.userTo)) {
    valid = false;
    details.userTo = 'self';
  }

  // Some interaction must have happened
  const isInteraction =
    req.body.interactions &&
    (req.body.interactions.met ||
      req.body.interactions.hostedMe ||
      req.body.interactions.hostedThem);
  if (!isInteraction) {
    valid = false;
    interactionErrors.any = 'missing';
  }

  // Value of 'recommend' must be valid ('yes', 'no', 'unknown')
  if (
    req.body.recommend &&
    !['yes', 'no', 'unknown'].includes(req.body.recommend)
  ) {
    valid = false;
    details.recommend = "one of 'yes', 'no', 'unknown' expected";
  }

  // Values of interactions must be boolean
  ['met', 'hostedMe', 'hostedThem'].forEach(function (interaction) {
    if (
      _.has(req, ['body', 'interactions', interaction]) &&
      typeof req.body.interactions[interaction] !== 'boolean'
    ) {
      valid = false;
      interactionErrors[interaction] = 'boolean expected';
    }
  });

  // Value of userTo must exist and be a UserId
  if (!_.has(req, ['body', 'userTo'])) {
    valid = false;
    details.userTo = 'missing';
  } else if (!mongoose.Types.ObjectId.isValid(req.body.userTo)) {
    valid = false;
    details.userTo = 'userId expected';
  }

  if (_.has(req, ['body', 'feedbackPublic'])) {
    req.body.feedbackPublic = textService.plainText(req.body.feedbackPublic);
    const { feedbackPublic } = req.body;
    if (
      feedbackPublic.length > config.limits.maximumReferenceFeedbackPublicLength
    ) {
      valid = false;
      details.feedbackPublic = 'toolong';
    }
  }

  // No unexpected fields
  const allowedFields = [
    'userTo',
    'interactions',
    'recommend',
    'feedbackPublic',
  ];
  const fields = Object.keys(req.body);
  const unexpectedFields = _.difference(fields, allowedFields);
  const allowedInteractions = ['met', 'hostedMe', 'hostedThem'];
  const interactions = Object.keys(req.body.interactions || {});
  const unexpectedInteractions = _.difference(
    interactions,
    allowedInteractions,
  );
  if (unexpectedFields.length > 0 || unexpectedInteractions.length > 0) {
    valid = false;
    details.fields = 'unexpected';
  }

  if (Object.keys(interactionErrors).length > 0)
    details.interactions = interactionErrors;

  return { valid, details };
}

class ResponseError {
  constructor({ status, body }) {
    this.status = status;
    this.body = body;
  }
}

const nonpublicReferenceFields = [
  '_id',
  'created',
  'public',
  'userFrom',
  'userTo',
];

const referenceFields = nonpublicReferenceFields.concat([
  'feedbackPublic',
  'interactions.hostedMe',
  'interactions.hostedThem',
  'interactions.met',
  'recommend',
]);

/**
 * Convert mongoose object to a reference with limited fields
 * @param {MongooseObject|object} reference - the raw reference
 * @param {boolean} isNonpublicFullyDisplayed - can we show all fields of the nonpublic reference?
 * @returns {object} the reference, either full or limited
 */
function formatReference(reference, fromLoggedInUser) {
  // converts MongooseObject to Object and picks only defined fields
  if (reference.public || fromLoggedInUser) {
    return _.pick(reference, referenceFields);
  } else {
    return _.pick(reference, nonpublicReferenceFields);
  }
}

async function findMyReference(req, userTo) {
  return await Reference.findOne({
    userFrom: req.user._id,
    userTo,
  }).exec();
}

/**
 * Check if the reference already exists. If it exists, return an error in a callback.
 */
async function checkDuplicate(req) {
  const ref = await findMyReference(req, req.body.userTo);
  if (ref === null) return;

  throw new ResponseError({ status: 409, body: { errType: 'conflict' } });
}

/**
 * Express response in callback of async.waterfall
 * @param {object} resOrErr - if this is a well specified object, it will trigger a response,
 *                                   otherwise 500 error
 * @param {integer} [resOrErr.status] - html status of the response
 * @param {any} [resOrErr.body] - response body
 * @param {string} [resOrErr.body.errType] - will be transformed to body.message by errorService by key
 */
function processResponses(res, next, resOrErr) {
  // send error responses
  if (resOrErr && resOrErr.status && resOrErr.body) {
    if (resOrErr.body.errType) {
      resOrErr.body.message = errorService.getErrorMessageByKey(
        resOrErr.body.errType,
      );
      delete resOrErr.body.errType;
    }
    return res.status(resOrErr.status).json(resOrErr.body);
  }

  // take care of unexpected errors
  return next(resOrErr);
}

/**
 * Validate request with validator and call callback with prepared error response
 * @param {function} validator - function (parameter): { valid: boolean, details: string[] }
 * @param {object} req - Express Request object
 * @param {function} cb - callback function
 */
function validate(validator, req) {
  const validation = validator(req);

  if (validation.valid) {
    return;
  }

  throw new ResponseError({
    status: 400,
    body: { errType: 'bad-request', details: validation.details },
  });
}

async function isUserToPublic(req) {
  const userTo = await User.findOne({ _id: req.body.userTo }).exec();

  // Can't create a reference to a nonexistent user
  // Can't create a reference to a nonpublic user
  if (!userTo || !userTo.public) {
    throw new ResponseError({
      status: 404,
      body: {
        errType: 'not-found',
        details: {
          userTo: 'not found',
        },
      },
    });
  }

  return userTo;
}

function validateReplyToPublicReference(otherReference, req) {
  if (otherReference && otherReference.public && req.body.recommend !== 'yes') {
    throw new ResponseError({
      status: 400,
      body: {
        errType: 'bad-request',
        details: {
          recommend: "'yes' expected - response to public",
        },
      },
    });
  }
}

async function saveNewReference(referenceData) {
  const reference = new Reference(referenceData);
  return await reference.save();
}

async function publishOtherReference(otherReference) {
  if (otherReference && !otherReference.public) {
    otherReference.set({ public: true });
    await otherReference.save();
  }
}

async function sendEmailNotification(
  userFrom,
  userTo,
  savedReference,
  otherReference,
) {
  if (!otherReference) {
    return util.promisify(emailService.sendReferenceNotificationFirst)(
      userFrom,
      userTo,
    );
  } else {
    return util.promisify(emailService.sendReferenceNotificationSecond)(
      userFrom,
      userTo,
      savedReference,
    );
  }
}

async function sendPushNotification(userFrom, userTo, { isFirst }) {
  return util.promisify(pushService.notifyNewReference)(userFrom, userTo, {
    isFirst,
  });
}

/**
 * Create a reference - express middleware
 */
exports.create = async function (req, res, next) {
  // each of the following functions throws a special response error when it wants to respond
  // this special error gets processed within the catch {}
  try {
    // Synchronous validation of the request data consistency
    validate(validateCreate, req);

    // Check that the reference is not duplicate
    await checkDuplicate(req);

    // Check if the receiver of the reference exists and is public
    const userTo = await isUserToPublic(req);

    // Check if the opposite direction reference exists
    // when it exists, we will want to make both references public
    const otherReference = await Reference.findOne({
      userFrom: req.body.userTo,
      userTo: req.user._id,
    }).exec();

    // when the other reference is public, this one can only have value of recommend: yes
    validateReplyToPublicReference(otherReference, req);

    // save the reference...
    const savedReference = await saveNewReference({
      ...req.body,
      userFrom: req.user._id,
      public: !!otherReference,
    });

    // ...and if this is a reference reply, make the other reference public, too
    await publishOtherReference(otherReference);

    // send email notification
    await sendEmailNotification(
      req.user,
      userTo,
      savedReference,
      otherReference,
    );

    // send push notification
    await sendPushNotification(req.user, userTo, { isFirst: !otherReference });

    // finally, respond
    throw new ResponseError({
      status: 201,
      body: formatReference(savedReference, true),
    });
  } catch (e) {
    processResponses(res, next, e);
  }
};

/**
 * Validator for readMany controller
 */
function validateReadMany(req) {
  if (!mongoose.Types.ObjectId.isValid(req.query.userTo)) {
    return {
      valid: false,
      details: { userTo: req.query.userTo ? 'invalid' : 'missing' },
    };
  }

  return { valid: true, details: {} };
}

/**
 * Read references filtered by userTo
 * and sorted by 'created' field starting from the most recent date
 */
exports.readMany = async function readMany(req, res, next) {
  try {
    // validate the query
    validate(validateReadMany, req);

    const { userTo } = req.query;
    const self = req.user;

    const matchQuery = {
      $or: [
        { userTo: new mongoose.Types.ObjectId(userTo) },
        { userFrom: new mongoose.Types.ObjectId(userTo) },
      ],
    };
    // Allow non-public references only when userTo is self
    if (!self._id.equals(userTo)) {
      matchQuery.public = true;
    }

    // Aggregate projection for User in reference
    const userKeys = {
      _id: 1,
      updated: 1,
      displayName: 1,
      username: 1,
      avatarSource: 1,
      avatarUploaded: 1,
      emailHash: 1,
      created: 1,
      gender: 1,
      additionalProvidersData: {
        facebook: {
          id: 1,
        },
      },
    };

    // Find references
    const references = await Reference.aggregate([
      {
        $match: matchQuery,
      },

      // Extend user objects
      {
        $lookup: {
          from: 'users',
          localField: 'userTo',
          foreignField: '_id',
          as: 'userTo',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userFrom',
          foreignField: '_id',
          as: 'userFrom',
        },
      },

      // Because above `$lookup`s return and arrays with one user
      // `[{userObject}]`, we have to unwind it back to `{userObject}`
      { $unwind: '$userTo' },
      { $unwind: '$userFrom' },

      // Pick fields to receive
      {
        $project: {
          _id: 1,
          created: 1,
          public: 1,
          userFrom: userKeys,
          userTo: userKeys,
          feedbackPublic: 1,
          interactions: {
            hostedMe: 1,
            hostedThem: 1,
            met: 1,
          },
          recommend: 1,
        },
      },
      { $sort: { created: -1 } },
    ]).exec();

    // when userFrom is self, we can see the nonpublic references in their full form
    throw new ResponseError({
      status: 200,
      body: references.map(reference =>
        formatReference(reference, self._id.equals(reference.userFrom._id)),
      ),
    });
  } catch (e) {
    processResponses(res, next, e);
  }
};

/**
 * Validator for id of referenceById controller
 * @param {string} id - referenceId
 */
function validateReadOne(id) {
  let valid = true;
  const details = {};

  const isIdValid = mongoose.Types.ObjectId.isValid(id);
  if (!isIdValid) {
    valid = false;
    details.referenceId = 'invalid';
  }

  return { valid, details };
}

/**
 * Load a reference by id to request.reference
 */
exports.referenceById = async function referenceById(req, res, next, id) {
  // eslint-disable-line no-unused-vars
  try {
    // don't bother fetching a reference for non-public users or guests
    if (!req.user || !req.user.public) return next();

    // validate
    validate(validateReadOne, id);

    const selfId = req.user._id;

    // find the reference by id
    const reference = await Reference.findById(req.params.referenceId)
      .select(referenceFields)
      .populate('userFrom userTo', userProfile.userMiniProfileFields)
      .exec();

    const userFromId = reference ? reference.userFrom._id : null;
    const userToId = reference ? reference.userTo._id : null;

    // make sure that nonpublic references are not exposed
    // nonpublic reference can be exposed to userFrom or userTo only.
    const isExistentPublicOrFromToSelf =
      reference &&
      (reference.public ||
        userFromId.equals(selfId) ||
        userToId.equals(selfId));
    if (!isExistentPublicOrFromToSelf) {
      throw new ResponseError({
        status: 404,
        body: {
          errType: 'not-found',
          details: {
            reference: 'not found',
          },
        },
      });
    }

    // assign the reference to the request object
    // when reference is not public, only userFrom can see it whole
    const isUserFrom = userFromId === selfId;
    req.reference = formatReference(reference, isUserFrom);
    return next();
  } catch (e) {
    processResponses(res, next, e);
  }
};

/**
 * Read a reference by id
 */
exports.readOne = function readOne(req, res) {
  return res.status(200).json(req.reference);
};

exports.readMine = async function readMine(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.query.userTo)) {
    return res
      .status(400)
      .send({ message: 'Missing or invalid `userTo` request param' });
  }
  const reference = await findMyReference(req, req.query.userTo);
  if (reference === null) {
    return res.status(404).json({
      message: errorService.getErrorMessageByKey('not-found'),
    });
  }
  return res.status(200).json(reference);
};

exports.getCount = async function getCount(req, res, next) {
  const { userTo } = req.query;

  if (!mongoose.Types.ObjectId.isValid(userTo)) {
    return res
      .status(400)
      .send({ message: 'Missing or invalid `userTo` request param' });
  }

  try {
    const isSelf = req.user._id.equals(userTo);

    const query = {
      userTo: new mongoose.Types.ObjectId(userTo),
    };

    const publicCount = await Reference.find({
      ...query,
      public: true,
    }).count();

    // Include non-public references only when userTo is self
    const privateCount = isSelf
      ? await Reference.find({
          ...query,
          public: false,
        }).count()
      : 0;

    return res.status(200).json({
      count: privateCount + publicCount,
      // `hasPending` included only for own profile
      ...(isSelf ? { hasPending: Boolean(privateCount) } : {}),
    });
  } catch (error) {
    processResponses(res, next, error);
  }
};
