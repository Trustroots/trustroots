/**
 * @template Id, Timestamp
 * @template {{ _id: Id }} Member
 * @typedef {import('../../shared/experience.js').ExperienceResponse<Id, Timestamp> & { public: boolean, userFrom: Member, userTo: Member }} StoredExperience
 */

/**
 * Select only the reciprocal feedback fields exposed by the API.
 * @template Id, Timestamp
 * @param {import('../../shared/experience.js').ExperienceResponse<Id, Timestamp>} experience
 * @returns {import('../../shared/experience.js').ExperienceResponse<Id, Timestamp>}
 */
function prepareResponse(experience) {
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

/**
 * Keep private feedback hidden from everyone except its author.
 * Member identifiers can be either populated records or bare database IDs.
 * @template Id, Timestamp
 * @template {{ _id: Id }} Member
 * @param {StoredExperience<Id, Timestamp, Member>} experience
 * @param {import('../../shared/experience.js').ExperienceResponse<Id, Timestamp> | null} response
 * @param {{ equals: (id: Id) => boolean }} authUserId
 * @returns {import('../../shared/experience.js').ExperiencePayload<Id, Timestamp, Member>}
 */
export function prepareSendingToClient(experience, response, authUserId) {
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

/**
 * Construct the persisted fields from the shared, validated create request.
 * @template Id
 * @param {import('../../shared/experience.js').CreateExperienceRequest} body
 * @param {Id} userFrom
 * @param {boolean} isPublic
 * @returns {import('../../shared/experience.js').CreateExperienceRequest & { userFrom: Id, public: boolean }}
 */
export function prepareNewExperience(body, userFrom, isPublic) {
  return { ...body, userFrom, public: isPublic };
}

/**
 * @param {number} publicCount
 * @param {number} privateCount
 * @param {boolean} isSelf
 * @returns {import('../../shared/experience.js').ExperienceCount}
 */
export function prepareExperienceCount(publicCount, privateCount, isSelf) {
  return {
    count: privateCount + publicCount,
    ...(isSelf ? { hasPending: Boolean(privateCount) } : {}),
  };
}
