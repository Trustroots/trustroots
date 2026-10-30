import crypto from 'node:crypto';
import mongoose, { type Types } from 'mongoose';
import config from '../../../../config/config.mts';
import textService from '../../../core/server/services/text.server.service.mts';
import type {
  ExperienceChangeAccess,
  ExperienceChangeProposal,
  ExperienceChangeRequestKind,
  ExperienceChangeRequestSummary,
  ExperienceChangeSubmissionResult,
  ExperienceChangeSubmission,
} from '../../shared/experience-change.js';
import type {
  ExperienceInteractions,
  ExperienceRecommendation,
} from '../../shared/experience.js';

interface AuthenticatedMember {
  _id: Types.ObjectId;
}

interface ChangeRequest {
  _id: Types.ObjectId;
  experience: Types.ObjectId;
  requester: Types.ObjectId;
  linkIssuedBy?: Types.ObjectId;
  original?: {
    feedbackPublic: string;
    recommend: ExperienceRecommendation;
    interactions: ExperienceInteractions;
  };
  kind: ExperienceChangeRequestKind;
  proposed?: ExperienceChangeProposal;
  status: 'pending' | 'processing' | 'approved' | 'rejected';
  createdAt: Date;
  reviewedAt?: Date;
}

interface ExperienceRecord {
  _id: Types.ObjectId;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  public: boolean;
  recommend: ExperienceRecommendation;
  interactions: ExperienceInteractions;
  feedbackPublic?: string;
  removedAt?: Date;
}

interface ChangeLinkRecord {
  issuedBy: Types.ObjectId;
  experience: Types.ObjectId;
  member: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
}

type ChangeRequestInput = {
  experience: Types.ObjectId;
  requester: Types.ObjectId;
} & ExperienceChangeSubmission;

type IdInput = Parameters<typeof mongoose.Types.ObjectId.isValid>[0];

interface AuthenticatedRequest {
  params: { id?: string };
  body: unknown;
  user: AuthenticatedMember;
  get(name: string): string | undefined;
}

interface ErrorResponse {
  message: string;
}

interface JsonResponse<Body> {
  status(code: number): this;
  json(body: Body | ErrorResponse): this;
}

type Next = (error?: unknown) => void;
type Handler<Success> = (
  request: AuthenticatedRequest,
  response: JsonResponse<Success | ErrorResponse>,
  next: Next,
) => Promise<unknown>;

const Experience = mongoose.model<ExperienceRecord>('Experience');
const ExperienceChangeLink = mongoose.model<ChangeLinkRecord>(
  'ExperienceChangeLink',
);
const ExperienceChangeRequest = mongoose.model<ChangeRequest>(
  'ExperienceChangeRequest',
);

function isId(value: unknown): value is IdInput {
  return mongoose.Types.ObjectId.isValid(
    value as Parameters<typeof mongoose.Types.ObjectId.isValid>[0],
  );
}

function equals(left: Types.ObjectId, right: Types.ObjectId): boolean {
  return String(left) === String(right);
}

function bodyField(body: unknown, key: string): unknown {
  if (body === null || body === undefined) {
    // Keep the previous destructuring/property access failure for null bodies.
    throw new TypeError(`Cannot read properties of ${body} (reading '${key}')`);
  }
  // Express's JSON parser rejects null/scalar top-level bodies; nested values remain unknown.
  return Reflect.get(Object(body), key);
}

function bodyKeys(body: unknown): string[] {
  return Object.keys(Object(body));
}

async function loadExperience<Body>(
  request: AuthenticatedRequest,
  response: JsonResponse<Body>,
  options: { allowRemoved?: boolean } = {},
): Promise<ExperienceRecord | null> {
  if (!isId(request.params.id)) {
    response.status(400).json({ message: 'Invalid Experience identifier.' });
    return null;
  }

  const experience = await Experience.findById(request.params.id).lean().exec();
  if (
    !experience ||
    (experience.removedAt && !options.allowRemoved) ||
    (!equals(experience.userFrom, request.user._id) &&
      !equals(experience.userTo, request.user._id))
  ) {
    response.status(404).json({ message: 'Experience not found.' });
    return null;
  }
  return experience;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function loadValidLink(
  request: AuthenticatedRequest,
  experience: ExperienceRecord,
): Promise<ChangeLinkRecord | null> {
  const token = request.get('X-Experience-Change-Secret');
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;

  const link = await ExperienceChangeLink.findOne({
    experience: experience._id,
    member: request.user._id,
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  })
    .lean()
    .exec();
  return link;
}

function validateEdit(body: unknown): ExperienceChangeProposal | null {
  const proposed = bodyField(body, 'proposed');
  if (
    !proposed ||
    bodyKeys(body).some(key => !['kind', 'proposed'].includes(key))
  ) {
    return null;
  }
  const proposedFeedback = bodyField(proposed, 'feedbackPublic');
  const proposedRecommendation = bodyField(proposed, 'recommend');
  const interactions = bodyField(proposed, 'interactions');
  if (typeof proposedFeedback !== 'string') return null;
  if (
    bodyKeys(proposed).some(
      key => !['feedbackPublic', 'recommend', 'interactions'].includes(key),
    ) ||
    (proposedRecommendation !== 'yes' &&
      proposedRecommendation !== 'no' &&
      proposedRecommendation !== 'unknown') ||
    !interactions
  ) {
    return null;
  }
  const met = bodyField(interactions, 'met');
  const guest = bodyField(interactions, 'guest');
  const host = bodyField(interactions, 'host');
  if (
    bodyKeys(interactions).some(
      key => !['met', 'guest', 'host'].includes(key),
    ) ||
    typeof met !== 'boolean' ||
    typeof guest !== 'boolean' ||
    typeof host !== 'boolean' ||
    !(met || guest || host)
  ) {
    return null;
  }

  const feedbackPublic = textService.plainText(proposedFeedback, false);
  if (
    feedbackPublic.length > config.limits.maximumExperienceFeedbackPublicLength
  ) {
    return null;
  }

  return {
    feedbackPublic,
    recommend: proposedRecommendation,
    interactions: { met, guest, host },
  };
}

const readAccess: Handler<ExperienceChangeAccess<Types.ObjectId>> = async (
  request,
  response,
  next,
) => {
  try {
    const experience = await loadExperience(request, response);
    if (!experience) return;
    if (!(await loadValidLink(request, experience))) {
      return response
        .status(403)
        .json({ message: 'This link is invalid or has expired.' });
    }

    const isAuthor = equals(experience.userFrom, request.user._id);
    const result: ExperienceChangeAccess<Types.ObjectId> = {
      _id: experience._id,
      public: experience.public,
      canEdit: isAuthor,
      ...(isAuthor || experience.public
        ? {
            feedbackPublic: experience.feedbackPublic || '',
            recommend: experience.recommend,
            interactions: experience.interactions,
          }
        : {}),
    };
    return response.json(result);
  } catch (error) {
    return next(error);
  }
};

const readMine: Handler<
  ExperienceChangeRequestSummary<Types.ObjectId, Date> | null
> = async (request, response, next) => {
  try {
    const experience = await loadExperience(request, response, {
      allowRemoved: true,
    });
    if (!experience) return;

    const changeRequest = await ExperienceChangeRequest.findOne({
      experience: experience._id,
      requester: request.user._id,
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const result: ExperienceChangeRequestSummary<Types.ObjectId, Date> | null =
      changeRequest
        ? {
            _id: changeRequest._id,
            kind: changeRequest.kind,
            status: changeRequest.status,
            createdAt: changeRequest.createdAt,
            reviewedAt: changeRequest.reviewedAt,
          }
        : null;
    return response.json(result);
  } catch (error) {
    return next(error);
  }
};

const submit: Handler<
  ExperienceChangeSubmissionResult<Types.ObjectId, Date>
> = async (request, response, next) => {
  try {
    const experience = await loadExperience(request, response);
    if (!experience) return;
    const link = await loadValidLink(request, experience);
    if (!link) {
      return response
        .status(403)
        .json({ message: 'This link is invalid or has expired.' });
    }

    const kind = bodyField(request.body, 'kind');
    if (kind !== 'edit' && kind !== 'remove') {
      return response.status(400).json({ message: 'Invalid request type.' });
    }
    let input: ChangeRequestInput;
    if (kind === 'edit') {
      if (!equals(experience.userFrom, request.user._id)) {
        return response
          .status(403)
          .json({ message: 'Only the author can propose an edit.' });
      }
      const proposed = validateEdit(request.body);
      if (
        !proposed ||
        bodyKeys(request.body).some(key => !['kind', 'proposed'].includes(key))
      ) {
        return response
          .status(400)
          .json({ message: 'Invalid change request.' });
      }
      input = {
        experience: experience._id,
        requester: request.user._id,
        kind,
        proposed,
      };
    } else {
      if (bodyKeys(request.body).some(key => key !== 'kind')) {
        return response
          .status(400)
          .json({ message: 'Invalid change request.' });
      }
      input = {
        experience: experience._id,
        requester: request.user._id,
        kind,
      };
    }

    const existing = await ExperienceChangeRequest.exists({
      experience: experience._id,
      status: { $in: ['pending', 'processing'] },
    });
    if (existing) {
      return response
        .status(409)
        .json({ message: 'An Experience change is already pending.' });
    }

    const changeRequest = await ExperienceChangeRequest.create({
      ...input,
      linkIssuedBy: link.issuedBy,
      original: {
        feedbackPublic: experience.feedbackPublic || '',
        recommend: experience.recommend,
        interactions: experience.interactions,
      },
    });
    const result: ExperienceChangeSubmissionResult<Types.ObjectId, Date> = {
      _id: changeRequest._id,
      kind: changeRequest.kind,
      status: changeRequest.status,
      createdAt: changeRequest.createdAt,
    };
    return response.status(201).json(result);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return response
        .status(409)
        .json({ message: 'An Experience change is already pending.' });
    }
    return next(error);
  }
};

function isDuplicateKeyError(error: unknown): boolean {
  if (error === null || error === undefined) {
    // The previous `error.code` check threw for nullish rejection values.
    throw new TypeError(`Cannot read properties of ${error} (reading 'code')`);
  }
  return (
    (typeof error === 'object' || typeof error === 'function') &&
    Reflect.get(error, 'code') === 11000
  );
}

const service = { readAccess, readMine, submit };
/** @esmNamed */
export { readAccess, readMine, submit };
export default service;
