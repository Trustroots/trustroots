import mongoose from 'mongoose';
import _ from 'lodash';
import util from 'util';
import config from '../../../../config/config.js';
import textService from '../../../core/server/services/text.server.service.js';
import errorService from '../../../core/server/services/error.server.service.js';
import emailService from '../../../core/server/services/email.server.service.js';
import userProfile from '../../../users/server/controllers/users.profile.server.controller.js';
import userMiniService from '../../../users/server/services/user-mini.server.service.js';
import userRolesService from '../../../users/server/services/user-roles.server.service.js';
import {
  prepareExperienceCount,
  prepareNewExperience,
  prepareSendingToClient,
} from '../services/experience-payload.server.service.js';

const service = {};

const Contact = mongoose.model('Contact');
const Experience = mongoose.model('Experience');
const User = mongoose.model('User');
const visibleAuthorRoles = { $nin: userRolesService.restrictedMessagingRoles };

/**
 * Return one confirmed, public contact for whom the authenticated member has
 * not yet shared an experience.
 */
service.getSuggestion = async function getSuggestion(req, res, next) {
  try {
    const selfId = req.user._id;
    const experiencedUserIds = await Experience.distinct('userTo', {
      userFrom: selfId,
    }).exec();
    const excludedUserIds = [selfId, ...experiencedUserIds];

    excludedUserIds.push(...(req.user.blocked || []));

    const [suggestion] = await Contact.aggregate([
      {
        $match: {
          confirmed: true,
          $or: [{ userFrom: selfId }, { userTo: selfId }],
        },
      },
      {
        $project: {
          userId: {
            $cond: [{ $eq: ['$userFrom', selfId] }, '$userTo', '$userFrom'],
          },
        },
      },
      { $match: { userId: { $nin: excludedUserIds } } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $match: {
          'user.public': true,
          'user.roles': { $nin: ['shadowban', 'suspended'] },
          'user.blocked': { $nin: [selfId] },
        },
      },
      { $sample: { size: 1 } },
      {
        $project: {
          _id: '$user._id',
          displayName: '$user.displayName',
          username: '$user.username',
        },
      },
    ]).exec();

    return res.json(suggestion || null);
  } catch (err) {
    return next(err);
  }
};

/**
 * Validate the request body and data consistency
 * of an experience
 * @param {{ user: { _id: { equals: (userId: string) => boolean } }, body: import('../../shared/experience').CreateExperienceRequest }} req
 */
function validateCreate(req) {
  let valid = true;
  const details = {};
  const interactionErrors = {};

  // Can't create an experience to oneself
  if (req.user._id.equals(req.body.userTo)) {
    valid = false;
    details.userTo = 'self';
  }

  // Some interaction must have happened
  const isInteraction =
    req.body.interactions &&
    (req.body.interactions.met ||
      req.body.interactions.guest ||
      req.body.interactions.host);
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
  ['met', 'guest', 'host'].forEach(function (interaction) {
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
      feedbackPublic.length >
      config.limits.maximumExperienceFeedbackPublicLength
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
  const allowedInteractions = ['met', 'guest', 'host'];
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

async function findMyExperience(req, userTo) {
  return await Experience.findOne({
    userFrom: req.user._id,
    userTo,
  }).exec();
}

/**
 * Check if the experience already exists. If it exists, return an error in a callback.
 */
async function checkDuplicate(req) {
  const ref = await findMyExperience(req, req.body.userTo);
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

  // Can't create an experience to a nonexistent user
  // Can't create an experience to a nonpublic user
  if (
    !userTo ||
    !userTo.public ||
    userRolesService.hasRestrictedMessagingRole(userTo)
  ) {
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

function validateReplyToPublicExperience(otherExperience, req) {
  if (
    otherExperience &&
    otherExperience.public &&
    req.body.recommend !== 'yes'
  ) {
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

async function saveNewExperience(experienceData) {
  const experience = new Experience(experienceData);
  return await experience.save();
}

async function publishOtherExperience(otherExperience) {
  if (otherExperience && !otherExperience.public) {
    otherExperience.set({ public: true });
    await otherExperience.save();
  }
}

async function sendEmailNotification(
  userFrom,
  userTo,
  savedExperience,
  otherExperience,
) {
  if (!otherExperience) {
    return util.promisify(emailService.sendExperienceNotificationFirst)(
      userFrom,
      userTo,
    );
  } else {
    return util.promisify(emailService.sendExperienceNotificationSecond)(
      userFrom,
      userTo,
      savedExperience,
    );
  }
}

/**
 * Create an experience - express middleware
 */
service.create = async function (req, res, next) {
  // each of the following functions throws a special response error when it wants to respond
  // this special error gets processed within the catch {}
  const selfId = req.user._id;
  const senderIsRestricted = userRolesService.hasRestrictedMessagingRole(
    req.user,
  );
  try {
    // Synchronous validation of the request data consistency
    validate(validateCreate, req);

    // Check that the experience is not duplicate
    await checkDuplicate(req);

    // Check if the receiver of the experience exists and is public
    const userTo = await isUserToPublic(req);

    // Check if the opposite direction experience exists
    // when it exists, we will want to make both experiences public
    const otherExperience = senderIsRestricted
      ? null
      : await Experience.findOne({
          userFrom: req.body.userTo,
          userTo: selfId,
        }).exec();

    // when the other experience is public, this one can only have value of recommend: yes
    validateReplyToPublicExperience(otherExperience, req);

    // save the experience...
    const savedExperience = await saveNewExperience(
      prepareNewExperience(req.body, selfId, !!otherExperience),
    );

    // ...and if this is an experience reply, make the other experience public, too
    await publishOtherExperience(otherExperience);

    // send email notification
    await sendEmailNotification(
      req.user,
      userTo,
      savedExperience,
      otherExperience,
    );

    const experiencesWithResponses = prepareSendingToClient(
      savedExperience._doc,
      otherExperience,
      selfId,
    );

    // Future push: notify userTo about a new or reciprocal experience here
    // (previously notifyNewExperienceFirst / notifyNewExperienceSecond).

    // finally, respond
    throw new ResponseError({
      status: 201,
      body: experiencesWithResponses,
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

function pairUpExperiences(experiences, userId) {
  const experiencePairDict = experiences
    .filter(experience => experience.userTo._id.equals(userId))
    .reduce(
      (a, exp) => ({
        ...a,
        [exp.userFrom._id]: [exp, null],
      }),
      {},
    );

  experiences.forEach(experience => {
    if (experience.userFrom._id.equals(userId)) {
      const userTo = experience.userTo._id;
      if (experiencePairDict[userTo]) {
        experiencePairDict[userTo][1] = experience;
      }
    }
  });

  return Object.values(experiencePairDict);
}

/**
 * Read experiecnces filtered by userTo
 * and sorted by 'created' field starting from the most recent date
 */
service.readMany = async function readMany(req, res, next) {
  try {
    // validate the query
    validate(validateReadMany, req);

    const { userTo } = req.query;
    const selfId = req.user._id;

    const userToId = new mongoose.Types.ObjectId(userTo);
    let matchQuery = {
      $or: [{ userTo: userToId }, { userFrom: userToId }],
    };
    // Allow non-public experiences only when userTo is self
    if (!selfId.equals(userToId)) {
      matchQuery.public = true;
    }

    const privateFromSelfQuery = {
      userFrom: selfId,
      userTo: userToId,
      public: false,
    };

    matchQuery = {
      $or: [matchQuery, privateFromSelfQuery],
    };

    // Aggregate projection for User in experience
    const userKeys = userMiniService.userMiniProjectionMap({
      created: 1,
      gender: 1,
    });

    // Find experiences
    const experiences = await Experience.aggregate([
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
      { $match: { 'userFrom.roles': visibleAuthorRoles } },

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
            guest: 1,
            host: 1,
            met: 1,
          },
          recommend: 1,
        },
      },
      { $sort: { created: -1 } },
    ]).exec();

    const pairedUpExperiences = pairUpExperiences(experiences, userToId);
    const experiencesWithResponses = pairedUpExperiences.map(experiencePair =>
      prepareSendingToClient(...experiencePair, selfId),
    );

    throw new ResponseError({
      status: 200,
      body: experiencesWithResponses,
    });
  } catch (e) {
    processResponses(res, next, e);
  }
};

/**
 * Validator for id of experienceById controller
 * @param {string} id - experienceId
 */
function validateReadOne(id) {
  let valid = true;
  const details = {};

  const isIdValid = mongoose.Types.ObjectId.isValid(id);
  if (!isIdValid) {
    valid = false;
    details.experienceId = 'invalid';
  }

  return { valid, details };
}

/**
 * Load an experience by id to request.experience
 */
service.experienceById = async function experienceById(req, res, next, id) {
  try {
    // don't bother fetching an experience for non-public users or guests
    if (!req.user || !req.user.public) return next();

    // validate
    validate(validateReadOne, id);

    const selfId = req.user._id;

    // find the experience by id
    const experience = await Experience.findById(req.params.experienceId)
      .populate({
        path: 'userFrom',
        select: userProfile.userMiniProfileFields,
        match: { roles: visibleAuthorRoles },
      })
      .populate('userTo', userProfile.userMiniProfileFields)
      .exec();

    const userFromId = experience?.userFrom?._id;
    const userToId = experience ? experience.userTo._id : null;

    // make sure that nonpublic experiences are not exposed
    // nonpublic experience can be exposed to userFrom or userTo only.
    const isExistentPublicOrFromToSelf =
      experience &&
      userFromId &&
      (experience.public ||
        userFromId.equals(selfId) ||
        userToId.equals(selfId));
    if (!isExistentPublicOrFromToSelf) {
      throw new ResponseError({
        status: 404,
        body: {
          errType: 'not-found',
          details: {
            experience: 'not found',
          },
        },
      });
    }

    const response = await Experience.findOne({
      userFrom: userToId,
      userTo: userFromId,
    })
      .populate({ path: 'userFrom', match: { roles: visibleAuthorRoles } })
      .exec();

    const experienceWithResponse = prepareSendingToClient(
      experience,
      response?.userFrom ? response : null,
      selfId,
    );

    req.experience = experienceWithResponse;
    return next();
  } catch (e) {
    processResponses(res, next, e);
  }
};

/**
 * Read an experience by id
 */
service.readOne = function readOne(req, res) {
  return res.status(200).json(req.experience);
};

service.readMine = async function readMine(req, res) {
  const selfId = req.user._id;
  const userWith = req.query.userWith;

  if (!mongoose.Types.ObjectId.isValid(userWith)) {
    return res
      .status(400)
      .send({ message: 'Missing or invalid `userTo` request param' });
  }

  let experience = await findMyExperience(req, userWith);
  const visibleOtherAuthor = await User.exists({
    _id: userWith,
    roles: visibleAuthorRoles,
  });
  let otherExperience = visibleOtherAuthor
    ? await Experience.findOne({
        userFrom: userWith,
        userTo: selfId,
      }).exec()
    : null;

  if (experience === null && otherExperience === null) {
    return errorService.sendNotFound(res);
  }

  if (experience === null) {
    [experience, otherExperience] = [otherExperience, experience];
  }
  const experienceWithResponse = prepareSendingToClient(
    experience,
    otherExperience,
    selfId,
  );

  return res.status(200).json(experienceWithResponse);
};

service.getCount = async function getCount(req, res, next) {
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

    const counts = await Experience.aggregate([
      { $match: { ...query, ...(isSelf ? {} : { public: true }) } },
      // Drop counts authored by members with restricted roles
      // (suspended, shadowbanned)
      ...userMiniService.visibleUserLookupStages({
        localField: 'userFrom',
        as: 'author',
      }),
      { $group: { _id: '$public', count: { $sum: 1 } } },
    ]).exec();
    const { publicCount, privateCount } = counts.reduce(
      (result, group) => {
        result[group._id ? 'publicCount' : 'privateCount'] = group.count;
        return result;
      },
      { publicCount: 0, privateCount: 0 },
    );

    return res
      .status(200)
      .json(prepareExperienceCount(publicCount, privateCount, isSelf));
  } catch (error) {
    processResponses(res, next, error);
  }
};

const create = service.create;
const experienceById = service.experienceById;
const getCount = service.getCount;
const getSuggestion = service.getSuggestion;
const readMany = service.readMany;
const readMine = service.readMine;
const readOne = service.readOne;
export {
  create as create,
  experienceById as experienceById,
  getCount as getCount,
  getSuggestion as getSuggestion,
  readMany as readMany,
  readMine as readMine,
  readOne as readOne,
};
export default service;
