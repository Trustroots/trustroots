import type {
  CreateExperienceRequest,
  ExperienceCount,
  ExperiencePayload,
  ExperienceResponse,
} from '../../shared/experience.js';

type StoredExperience<
  Id,
  Timestamp,
  Member extends { _id: Id },
> = ExperienceResponse<Id, Timestamp> & {
  public: boolean;
  userFrom: Member;
  userTo: Member;
};

/** Select only the reciprocal feedback fields exposed by the API. */
function prepareResponse<Id, Timestamp>(
  experience: ExperienceResponse<Id, Timestamp>,
): ExperienceResponse<Id, Timestamp> {
  return {
    _id: experience._id,
    created: experience.created,
    interactions: {
      guest: experience.interactions.guest,
      host: experience.interactions.host,
      met: experience.interactions.met,
    },
    recommend: experience.recommend,
    ...('feedbackPublic' in experience
      ? { feedbackPublic: experience.feedbackPublic }
      : {}),
  };
}

/** Keep private feedback hidden from everyone except its author. */
export function prepareSendingToClient<
  Id,
  Timestamp,
  Member extends { _id: Id },
>(
  experience: StoredExperience<Id, Timestamp, Member>,
  response: ExperienceResponse<Id, Timestamp> | null,
  authUserId: { equals: (id: Id) => boolean },
): ExperiencePayload<Id, Timestamp, Member> {
  // Mongoose ObjectIds expose _id too, so this also supports unpopulated members.
  const visible =
    experience.public || authUserId.equals(experience.userFrom._id);
  return {
    _id: experience._id,
    created: experience.created,
    public: experience.public,
    userFrom: experience.userFrom,
    userTo: experience.userTo,
    ...(visible ? prepareResponse(experience) : {}),
    response: response ? prepareResponse(response) : null,
  };
}

/** Construct the persisted fields from the shared, validated create request. */
export function prepareNewExperience<Id>(
  body: CreateExperienceRequest,
  userFrom: Id,
  isPublic: boolean,
): CreateExperienceRequest & { userFrom: Id; public: boolean } {
  return { ...body, userFrom, public: isPublic };
}

export function prepareExperienceCount(
  publicCount: number,
  privateCount: number,
  isSelf: boolean,
): ExperienceCount {
  return {
    count: privateCount + publicCount,
    ...(isSelf ? { hasPending: Boolean(privateCount) } : {}),
  };
}
