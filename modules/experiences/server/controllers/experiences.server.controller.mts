import mongoose, { type HydratedDocument, type Types } from 'mongoose';
import _ from 'lodash';
import util from 'util';
import config from '../../../../config/config.mts';
import textService from '../../../core/server/services/text.server.service.mjs';
import errorService from '../../../core/server/services/error.server.service.mjs';
import emailService from '../../../core/server/services/email.server.service.mjs';
import userProfile from '../../../users/server/controllers/users.profile.server.controller.mjs';
import userMiniService from '../../../users/server/services/user-mini.server.service.mjs';
import userRolesService from '../../../users/server/services/user-roles.server.service.mjs';
import {
  prepareNewExperience,
  prepareSendingToClient,
} from '../services/experience-payload.server.service.mts';
import { getExperienceCount } from './experience-count.server.controller.mts';
import type {
  CreateExperienceRequest,
  ExperienceCount,
  ExperiencePayload,
} from '../../shared/experience.js';
import type { ExperienceRecord } from '../models/experiences.server.model.mts';

interface ExperienceUserRecord {
  _id: Types.ObjectId;
  public?: boolean;
  roles?: string[];
  blocked?: Types.ObjectId[];
  username?: string;
  displayName?: string;
  email?: string;
  gender?: string;
  created?: Date;
}

type ExperienceDocument = HydratedDocument<ExperienceRecord>;
type PopulatedExperienceRecord = Omit<
  ExperienceRecord,
  'userFrom' | 'userTo'
> & { userFrom: ExperienceUserRecord; userTo: ExperienceUserRecord };

interface ExperienceRequest {
  body: CreateExperienceRequest & Record<string, unknown>;
  query: { userTo?: string; userWith?: string };
  params: { experienceId?: string; recipientUsername?: string };
  user: ExperienceUserRecord;
  experience?: ExperiencePayload<
    Types.ObjectId,
    Date,
    Types.ObjectId | ExperienceUserRecord
  >;
}

interface ExperienceResponseWriter {
  status(code: number): ExperienceResponseWriter;
  json(body: ExperienceResponseBody): ExperienceResponseWriter;
  send(body: { message: string }): ExperienceResponseWriter;
}

type ExperienceResponseBody =
  | ExperiencePayload<Types.ObjectId, Date, ExperienceUserRecord>
  | Array<ExperiencePayload<Types.ObjectId, Date, ExperienceUserRecord>>
  | ExperiencePayload<
      Types.ObjectId,
      Date,
      Types.ObjectId | ExperienceUserRecord
    >
  | ExperienceCount
  | {
      _id: Types.ObjectId;
      displayName?: string;
      username?: string;
      ownExperience?: ExperiencePayload<Types.ObjectId, Date, Types.ObjectId>;
    }
  | { message?: string; details?: Record<string, unknown> }
  | null
  | undefined;

type ExperienceNext = (error?: unknown) => unknown;
type ExperienceHandler = (
  req: ExperienceRequest,
  res: ExperienceResponseWriter,
  next: ExperienceNext,
) => unknown;

interface ExperienceController {
  readReplyRecipient: ExperienceHandler;
  getSuggestion: ExperienceHandler;
  create: ExperienceHandler;
  readMany: ExperienceHandler;
  readMine: ExperienceHandler;
  readOne: ExperienceHandler;
  getCount: ExperienceHandler;
  experienceById: (
    req: ExperienceRequest,
    res: ExperienceResponseWriter,
    next: ExperienceNext,
    id: string,
  ) => unknown;
}

const service = {} as ExperienceController;

const Contact = mongoose.model<{
  confirmed: boolean;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
}>('Contact');
const Experience = mongoose.model<ExperienceRecord>('Experience');
const User = mongoose.model<ExperienceUserRecord>('User');
const visibleAuthorRoles = { $nin: userRolesService.restrictedMessagingRoles };
const plainText = textService.plainText as (
  content: unknown,
  cleanWhitespace?: boolean,
) => string;

// Provide minimal access to a blocked profile or an existing reply recipient.
service.readReplyRecipient = async function (req, res, next) {
  try {
    const recipient = await User.findOne({
      username: req.params.recipientUsername!.toLowerCase(),
      public: true,
      roles: visibleAuthorRoles,
    })
      .select('_id username displayName blocked')
      .exec();
    const incoming =
      recipient &&
      (await Experience.exists({
        userFrom: recipient._id,
        userTo: req.user._id,
        removedAt: { $exists: false },
      }));
    const blocked = recipient?.blocked?.some(id => id.equals(req.user._id));
    if (!recipient || (!incoming && !blocked)) {
      return res.status(404).json({
        message: errorService.getErrorMessageByKey('not-found'),
      });
    }
    const own = await findMyExperience(req, String(recipient._id));
    return res.json({
      _id: recipient._id,
      username: recipient.username,
      displayName: recipient.displayName,
      ...(own
        ? { ownExperience: prepareSendingToClient(own, null, req.user._id) }
        : {}),
    });
  } catch (error) {
    return next(error);
  }
};

type ObjectIdInput = Parameters<typeof mongoose.Types.ObjectId.isValid>[0];
function isValidObjectId(value: unknown): value is ObjectIdInput {
  return mongoose.Types.ObjectId.isValid(value as ObjectIdInput);
}

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
function validateCreate(req: ExperienceRequest) {
  let valid = true;
  const details: Record<string, unknown> = {};
  const interactionErrors: Record<string, string> = {};

  // Can't create an experience to oneself
  if (
    typeof req.body.userTo === 'string' &&
    req.user._id.equals(req.body.userTo)
  ) {
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
  const allowedInteractions = ['met', 'guest', 'host'] as const;
  allowedInteractions.forEach(function (interaction) {
    if (
      _.has(req, ['body', 'interactions', interaction]) &&
      typeof req.body.interactions?.[interaction] !== 'boolean'
    ) {
      valid = false;
      interactionErrors[interaction] = 'boolean expected';
    }
  });

  // Value of userTo must exist and be a UserId
  if (!_.has(req, ['body', 'userTo'])) {
    valid = false;
    details.userTo = 'missing';
  } else if (!isValidObjectId(req.body.userTo)) {
    valid = false;
    details.userTo = 'userId expected';
  }

  if (_.has(req, ['body', 'feedbackPublic'])) {
    req.body.feedbackPublic = plainText(req.body.feedbackPublic, false);
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
  readonly status: number;
  readonly body:
    | ExperienceResponseBody
    | { errType: string; details?: Record<string, unknown> };

  constructor({
    status,
    body,
  }: {
    status: number;
    body:
      | ExperienceResponseBody
      | { errType: string; details?: Record<string, unknown> };
  }) {
    this.status = status;
    this.body = body;
  }
}

async function findMyExperience(req: ExperienceRequest, userTo: string) {
  return await Experience.findOne({
    userFrom: req.user._id,
    userTo,
    removedAt: { $exists: false },
  }).exec();
}

/**
 * Check if the experience already exists. If it exists, return an error in a callback.
 * Removed experiences still block duplicates for the same author/recipient pair.
 */
async function checkDuplicate(req: ExperienceRequest) {
  const ref = await Experience.findOne({
    userFrom: req.user._id,
    userTo: req.body.userTo,
  }).exec();
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
function processResponses(
  res: ExperienceResponseWriter,
  next: ExperienceNext,
  resOrErr: unknown,
) {
  const responseError =
    resOrErr instanceof ResponseError ? resOrErr : undefined;
  const responseBody =
    responseError &&
    responseError.body !== null &&
    typeof responseError.body === 'object'
      ? (responseError.body as Record<string, unknown>)
      : undefined;
  // send error responses
  if (responseError?.status && responseBody) {
    if (typeof responseBody.errType === 'string') {
      responseBody.message = errorService.getErrorMessageByKey(
        responseBody.errType,
      );
      delete responseBody.errType;
    }
    return res.status(responseError.status).json(responseBody);
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
function validate<T>(
  validator: (request: T) => {
    valid: boolean;
    details: Record<string, unknown>;
  },
  req: T,
) {
  const validation = validator(req);

  if (validation.valid) {
    return;
  }

  throw new ResponseError({
    status: 400,
    body: { errType: 'bad-request', details: validation.details },
  });
}

async function isUserToPublic(
  req: ExperienceRequest,
): Promise<ExperienceUserRecord> {
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

function validateReplyToPublicExperience(
  otherExperience: ExperienceDocument | null,
  req: ExperienceRequest,
) {
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

type NewExperienceInput = Omit<
  Partial<ExperienceRecord>,
  'interactions' | 'recommend'
> & {
  interactions?: Partial<ExperienceRecord['interactions']>;
  recommend?: ExperienceRecord['recommend'] | null;
};

async function saveNewExperience(experienceData: NewExperienceInput) {
  const experience = new Experience(experienceData);
  return await experience.save();
}

async function publishOtherExperience(
  otherExperience: ExperienceDocument | null,
) {
  if (otherExperience && !otherExperience.public) {
    otherExperience.set({ public: true });
    await otherExperience.save();
  }
}

async function sendEmailNotification(
  userFrom: ExperienceUserRecord,
  userTo: ExperienceUserRecord,
  savedExperience: ExperienceDocument,
  otherExperience: ExperienceDocument | null,
) {
  if (!otherExperience) {
    const sendFirst = emailService.sendExperienceNotificationFirst as (
      from: ExperienceUserRecord,
      to: ExperienceUserRecord,
      callback: (error?: Error | null) => void,
    ) => void;
    return util.promisify(sendFirst)(userFrom, userTo);
  } else {
    const sendSecond = emailService.sendExperienceNotificationSecond as (
      from: ExperienceUserRecord,
      to: ExperienceUserRecord,
      experience: ExperienceDocument,
      callback: (error?: Error | null) => void,
    ) => void;
    return util.promisify(sendSecond)(userFrom, userTo, savedExperience);
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
          removedAt: { $exists: false },
        }).exec();

    // when the other experience is public, this one can only have value of recommend: yes
    validateReplyToPublicExperience(otherExperience, req);

    // save the experience...
    const experienceInput = prepareNewExperience(
      req.body,
      selfId,
      !!otherExperience,
    );
    const savedExperience = await saveNewExperience({
      ...experienceInput,
      userTo: new mongoose.Types.ObjectId(experienceInput.userTo as string),
    });

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
      savedExperience.toObject(),
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
function validateReadMany(req: ExperienceRequest) {
  if (!isValidObjectId(req.query.userTo)) {
    return {
      valid: false,
      details: { userTo: req.query.userTo ? 'invalid' : 'missing' },
    };
  }

  return { valid: true, details: {} };
}

function pairUpExperiences(
  experiences: PopulatedExperienceRecord[],
  userId: Types.ObjectId,
): Array<[PopulatedExperienceRecord, PopulatedExperienceRecord | null]> {
  const experiencePairDict: Record<
    string,
    [PopulatedExperienceRecord, PopulatedExperienceRecord | null]
  > = {};
  experiences
    .filter(experience => experience.userTo._id.equals(userId))
    .forEach(experience => {
      experiencePairDict[String(experience.userFrom._id)] = [experience, null];
    });

  experiences.forEach(experience => {
    if (experience.userFrom._id.equals(userId)) {
      const userTo = String(experience.userTo._id);
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
    let matchQuery: Record<string, unknown> = {
      removedAt: { $exists: false },
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
      removedAt: { $exists: false },
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
    const experiences = await Experience.aggregate<PopulatedExperienceRecord>([
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
    const experiencesWithResponses = pairedUpExperiences.map(
      ([experience, response]) =>
        prepareSendingToClient<Types.ObjectId, Date, ExperienceUserRecord>(
          experience,
          response,
          selfId,
        ),
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
function validateReadOne(id: string | undefined) {
  let valid = true;
  const details: Record<string, string> = {};

  const isIdValid = isValidObjectId(id);
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
    const experience = (await Experience.findById(id)
      .populate({
        path: 'userFrom',
        select: userProfile.userMiniProfileFields,
        match: { roles: visibleAuthorRoles },
      })
      .populate('userTo', userProfile.userMiniProfileFields)
      .exec()) as
      | (ExperienceDocument & {
          userFrom: ExperienceUserRecord | null;
          userTo: ExperienceUserRecord;
        })
      | null;

    const userFromId = experience?.userFrom?._id;
    const userToId = experience ? experience.userTo._id : null;

    // make sure that nonpublic experiences are not exposed
    // nonpublic experience can be exposed to userFrom or userTo only.
    const isExistentPublicOrFromToSelf =
      experience &&
      !experience.removedAt &&
      userFromId &&
      (experience.public ||
        userFromId.equals(selfId) ||
        userToId!.equals(selfId));
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
      removedAt: { $exists: false },
    })
      .populate({ path: 'userFrom', match: { roles: visibleAuthorRoles } })
      .exec();

    const experienceWithResponse = prepareSendingToClient<
      Types.ObjectId,
      Date,
      ExperienceUserRecord
    >(
      experience as unknown as PopulatedExperienceRecord,
      response?.userFrom
        ? (response as unknown as PopulatedExperienceRecord)
        : null,
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

  if (!isValidObjectId(userWith)) {
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
        removedAt: { $exists: false },
      }).exec()
    : null;

  if (experience === null && otherExperience === null) {
    return errorService.sendNotFound(res);
  }

  if (experience === null) {
    [experience, otherExperience] = [otherExperience, experience];
  }
  const experienceWithResponse = prepareSendingToClient<
    Types.ObjectId,
    Date,
    Types.ObjectId
  >(experience!, otherExperience, selfId);

  return res.status(200).json(experienceWithResponse);
};

service.getCount = function getCount(req, res, next) {
  return getExperienceCount(req, res, next, processResponses);
};

const create = service.create;
const experienceById = service.experienceById;
const getCount = service.getCount;
const getSuggestion = service.getSuggestion;
const readReplyRecipient = service.readReplyRecipient;
const readMany = service.readMany;
const readMine = service.readMine;
const readOne = service.readOne;
export {
  create as create,
  experienceById as experienceById,
  getCount as getCount,
  getSuggestion as getSuggestion,
  readReplyRecipient as readReplyRecipient,
  readMany as readMany,
  readMine as readMine,
  readOne as readOne,
};
export default service;

export { service as 'module.exports' };
