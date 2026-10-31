import crypto from 'node:crypto';
import mongoose, { type QueryFilter, type Types } from 'mongoose';
import type {
  AdminExperienceChangeProposal,
  AdminExperienceChangeDecision,
  AdminExperienceChangeDecisionResult,
  AdminExperienceChangeLink,
  AdminExperienceChangeRequest,
  AdminExperienceChangeSearchExperience,
  AdminExperienceInteractions,
  AdminExperienceRecommendation,
} from '../../shared/admin-experience-change.js';

interface AuthenticatedMember {
  roles?: string[];
  _id: Types.ObjectId;
}

interface UserRecord {
  _id: Types.ObjectId;
  username: string;
  displayName?: string;
}

interface ExperienceRecord {
  _id: Types.ObjectId;
  created: Date;
  public: boolean;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  interactions: AdminExperienceInteractions;
  recommend: AdminExperienceRecommendation;
  feedbackPublic?: string;
  removedAt?: Date;
  appliedChangeRequests?: Types.ObjectId[];
}

interface ExperienceWithPopulatedMembers extends Omit<
  ExperienceRecord,
  'userFrom' | 'userTo'
> {
  userFrom: UserRecord | null;
  userTo: UserRecord | null;
}

interface ChangeLinkRecord {
  _id: Types.ObjectId;
  experience: Types.ObjectId;
  member: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  issuedBy: Types.ObjectId;
  createdAt: Date;
}

interface ChangeRequestBase {
  original?: AdminExperienceChangeProposal;
  _id: Types.ObjectId;
  experience: Types.ObjectId;
  requester: Types.ObjectId;
  linkIssuedBy?: Types.ObjectId;
  status: 'pending' | 'processing' | 'approved' | 'rejected';
  active: boolean;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
}

/** Edit proposals are validated before any request is inserted by this workflow. */
type ChangeRequestRecord =
  | (ChangeRequestBase & {
      kind: 'edit';
      proposed: AdminExperienceChangeProposal;
    })
  | (ChangeRequestBase & { kind: 'remove'; proposed?: never });

type ExperienceWithQueuedReferences = ExperienceWithPopulatedMembers;

/** The queue includes active requests and recently approved edits. */
type PopulatedChangeRequestRecord =
  | (Omit<ChangeRequestBase, 'experience' | 'requester' | 'status'> & {
      kind: 'edit';
      status: 'pending' | 'processing' | 'approved';
      active: boolean;
      proposed: AdminExperienceChangeProposal;
      experience: ExperienceWithQueuedReferences | null;
      requester: UserRecord | null;
    })
  | (Omit<ChangeRequestBase, 'experience' | 'requester' | 'status'> & {
      kind: 'remove';
      status: 'pending' | 'processing';
      active: true;
      proposed?: never;
      experience: ExperienceWithQueuedReferences | null;
      requester: UserRecord | null;
    });

interface AuthenticatedRequest {
  params: { id?: string };
  query: Record<string, unknown>;
  body: unknown;
  user: AuthenticatedMember;
}

type IdInput = Parameters<typeof mongoose.Types.ObjectId.isValid>[0];

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
const ExperienceChangeRequest = mongoose.model<
  ChangeRequestBase & {
    kind: 'edit' | 'remove';
    proposed?: AdminExperienceChangeProposal;
  }
>('ExperienceChangeRequest');
const User = mongoose.model<UserRecord>('User');
const active = { removedAt: { $exists: false } };
const APPROVED_EDIT_VISIBILITY_MS = 7 * 24 * 60 * 60 * 1000;
const OWN_PROFILE_DENIAL =
  'Support members cannot change Experiences on their own profile.';
const ISSUER_DENIAL =
  'Approval requires another support team member or an administrator.';

function isId(value: unknown): value is IdInput {
  return mongoose.Types.ObjectId.isValid(
    value as Parameters<typeof mongoose.Types.ObjectId.isValid>[0],
  );
}

function equals(left: Types.ObjectId, right: IdInput): boolean {
  return String(left) === String(right);
}

function bodyField(body: unknown, key: string): unknown {
  if (body === null || body === undefined) {
    throw new TypeError(`Cannot read properties of ${body} (reading '${key}')`);
  }
  // Express's JSON parser rejects null/scalar top-level bodies; nested values remain unknown.
  return Reflect.get(Object(body), key);
}

function isDecision(value: unknown): value is AdminExperienceChangeDecision {
  return value === 'approve' || value === 'reject';
}

const findExperiences: Handler<
  AdminExperienceChangeSearchExperience<Types.ObjectId, Date>[]
> = async (request, response, next) => {
  try {
    const username = String(request.query.username || '').trim();
    if (!username || username.length > 100) {
      return response.status(400).json({ message: 'Enter a member username.' });
    }
    const member = await User.findOne({ username })
      .select('_id username displayName')
      .lean()
      .exec();
    if (!member) return response.json([]);

    const experiences = await Experience.find({
      ...active,
      $or: [{ userFrom: member._id }, { userTo: member._id }],
    })
      .sort({ created: -1 })
      .limit(100)
      .populate<Pick<ExperienceWithPopulatedMembers, 'userFrom' | 'userTo'>>(
        'userFrom userTo',
        'username displayName',
      )
      .lean()
      .exec();
    return response.json(
      experiences.map(experience => ({
        ...experience,
        canIssue: canChange(request.user, experience),
      })),
    );
  } catch (error) {
    return next(error);
  }
};

const issueLink: Handler<AdminExperienceChangeLink<Date>> = async (
  request,
  response,
  next,
) => {
  try {
    if (!isId(request.params.id)) {
      return response
        .status(400)
        .json({ message: 'Invalid Experience or member.' });
    }
    const memberId = bodyField(request.body, 'memberId');
    if (!isId(memberId)) {
      return response
        .status(400)
        .json({ message: 'Invalid Experience or member.' });
    }
    const experience = await Experience.findOne({
      _id: request.params.id,
      ...active,
    })
      .lean()
      .exec();
    if (!experience) {
      return response.status(404).json({ message: 'Experience not found.' });
    }
    if (
      !equals(experience.userFrom, String(memberId)) &&
      !equals(experience.userTo, String(memberId))
    ) {
      return response
        .status(400)
        .json({ message: 'Member is not part of this Experience.' });
    }
    if (!canChange(request.user, experience)) {
      return response.status(403).json({ message: OWN_PROFILE_DENIAL });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await ExperienceChangeLink.findOneAndUpdate(
      {
        experience: experience._id,
        member: new mongoose.Types.ObjectId(memberId),
      },
      {
        tokenHash,
        expiresAt,
        issuedBy: request.user._id,
        createdAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();

    const result: AdminExperienceChangeLink<Date> = {
      path: `/experiences/${experience._id}/change?secret=${token}`,
      expiresAt,
    };
    return response.status(201).json(result);
  } catch (error) {
    return next(error);
  }
};

function queuedRequests(
  filter: QueryFilter<ChangeRequestRecord>,
  sort: Record<string, 1 | -1>,
) {
  return ExperienceChangeRequest.find(filter)
    .sort(sort)
    .limit(100)
    .populate<{ experience: ExperienceWithQueuedReferences | null }>({
      path: 'experience',
      populate: [
        { path: 'userFrom', select: 'username displayName' },
        { path: 'userTo', select: 'username displayName' },
      ],
    })
    .populate<{ requester: UserRecord | null }>(
      'requester',
      'username displayName',
    )
    .lean<PopulatedChangeRequestRecord[]>()
    .exec();
}

interface ExperienceParties {
  userFrom?: unknown;
  userTo?: unknown;
}

function isAdministrator(member: AuthenticatedMember): boolean {
  return Boolean(member.roles?.includes('admin'));
}

function idOf(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && '_id' in value) {
    return Reflect.get(value, '_id');
  }
  return value;
}

function sameId(left: unknown, right: unknown): boolean {
  if (
    left === null ||
    left === undefined ||
    right === null ||
    right === undefined
  ) {
    return false;
  }
  return String(left) === String(right);
}

/** A profile lists Experiences written by that member and written about them. */
function isOwnProfileExperience(
  memberId: Types.ObjectId,
  experience: ExperienceParties | null | undefined,
): boolean {
  if (!experience) return false;
  return (
    sameId(memberId, idOf(experience.userFrom)) ||
    sameId(memberId, idOf(experience.userTo))
  );
}

function canChange(
  member: AuthenticatedMember,
  experience: ExperienceParties | null | undefined,
): boolean {
  return (
    isAdministrator(member) || !isOwnProfileExperience(member._id, experience)
  );
}

function canApprove(
  member: AuthenticatedMember,
  changeRequest: { linkIssuedBy?: Types.ObjectId },
  experience: ExperienceParties | null | undefined,
): boolean {
  if (!canChange(member, experience)) return false;
  return Boolean(
    isAdministrator(member) ||
    (changeRequest.linkIssuedBy &&
      !sameId(changeRequest.linkIssuedBy, member._id)),
  );
}

const listRequests: Handler<
  AdminExperienceChangeRequest<Types.ObjectId, Date>[]
> = async (request, response, next) => {
  try {
    // Keep pending reviews and recent approvals in separate limited queries so
    // a full page of approvals cannot hide a review that is still waiting.
    const [pending, approved] = await Promise.all([
      queuedRequests({ active: true }, { createdAt: 1 }),
      queuedRequests(
        {
          kind: 'edit',
          status: 'approved',
          reviewedAt: {
            $gte: new Date(Date.now() - APPROVED_EDIT_VISIBILITY_MS),
          },
        },
        { reviewedAt: -1 },
      ),
    ]);
    const result = [...pending, ...approved];
    return response.json(
      result.map(changeRequest => ({
        ...changeRequest,
        canReview: canChange(request.user, changeRequest.experience),
        canApprove: canApprove(
          request.user,
          changeRequest,
          changeRequest.experience,
        ),
      })),
    );
  } catch (error) {
    return next(error);
  }
};

const decide: Handler<
  AdminExperienceChangeDecisionResult<Types.ObjectId>
> = async (request, response, next) => {
  try {
    if (!isId(request.params.id)) {
      return response.status(400).json({ message: 'Invalid review decision.' });
    }
    const decision = bodyField(request.body, 'decision');
    if (!isDecision(decision)) {
      return response.status(400).json({ message: 'Invalid review decision.' });
    }
    const pendingRequest = await ExperienceChangeRequest.findOne({
      _id: request.params.id,
      status:
        decision === 'approve' ? { $in: ['pending', 'processing'] } : 'pending',
      active: true,
    }).exec();
    if (!pendingRequest) {
      return response
        .status(409)
        .json({ message: 'This request is no longer pending.' });
    }
    const parties = await Experience.findById(pendingRequest.experience)
      .select('userFrom userTo')
      .lean<ExperienceParties | null>()
      .exec();
    if (!canChange(request.user, parties)) {
      return response.status(403).json({ message: OWN_PROFILE_DENIAL });
    }
    if (
      decision === 'approve' &&
      !canApprove(request.user, pendingRequest, parties)
    ) {
      return response.status(403).json({ message: ISSUER_DENIAL });
    }

    const rejecting = decision === 'reject';
    let changeRequest = await ExperienceChangeRequest.findOneAndUpdate(
      {
        _id: request.params.id,
        active: true,
        $or: rejecting
          ? [{ status: 'pending' }]
          : [
              { status: 'pending' },
              { status: 'processing', reviewedAt: { $exists: false } },
            ],
      },
      {
        $set: {
          status: rejecting ? 'rejected' : 'processing',
          active: !rejecting,
          reviewedAt: new Date(),
          reviewedBy: request.user._id,
        },
      },
      { new: true },
    )
      .lean<ChangeRequestRecord | null>()
      .exec();
    if (!changeRequest && !rejecting) {
      changeRequest = await ExperienceChangeRequest.findOne({
        _id: request.params.id,
        status: 'processing',
        active: true,
      })
        .lean<ChangeRequestRecord | null>()
        .exec();
    }
    if (!changeRequest) {
      return response.status(409).json({
        message: 'This request is no longer pending. Refresh the review queue.',
      });
    }
    if (rejecting)
      return response.json({ _id: changeRequest._id, status: 'rejected' });

    // Keep processing on uncertain failures. The marker and content are written
    // atomically to one document, so even a lost response is safe to retry.
    const update =
      changeRequest.kind === 'remove'
        ? {
            removedAt: changeRequest.reviewedAt,
            removedBy: changeRequest.reviewedBy,
          }
        : editUpdate(changeRequest.proposed);
    const result = await Experience.updateOne(
      {
        _id: changeRequest.experience,
        ...active,
        appliedChangeRequests: { $ne: changeRequest._id },
      },
      { $set: update, $addToSet: { appliedChangeRequests: changeRequest._id } },
    ).exec();
    if (
      result.matchedCount !== 1 &&
      !(await Experience.exists({
        _id: changeRequest.experience,
        appliedChangeRequests: changeRequest._id,
      }))
    ) {
      await ExperienceChangeRequest.updateOne(
        { _id: changeRequest._id, status: 'processing' },
        {
          $set: { status: 'pending' },
          $unset: { reviewedAt: 1, reviewedBy: 1 },
        },
      ).exec();
      return response.status(409).json({
        message:
          'This Experience is no longer available. Reject this request to close it.',
      });
    }
    await ExperienceChangeRequest.updateOne(
      { _id: changeRequest._id, status: 'processing', active: true },
      { $set: { status: 'approved', active: false } },
    ).exec();
    return response.json({ _id: changeRequest._id, status: 'approved' });
  } catch (error) {
    return next(error);
  }
};

function editUpdate(
  proposed: AdminExperienceChangeProposal,
): AdminExperienceChangeProposal {
  return {
    feedbackPublic: proposed.feedbackPublic,
    recommend: proposed.recommend,
    interactions: proposed.interactions,
  };
}

const service = { findExperiences, issueLink, listRequests, decide };
/** @esmNamed */
export { findExperiences, issueLink, listRequests, decide };
export default service;
