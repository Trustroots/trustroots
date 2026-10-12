const profileQueryFields = [
  'id',
  'displayName',
  'username',
  'gender',
  'tagline',
  'description',
  'locationFrom',
  'locationLiving',
  'languages',
  'birthdate',
  'seen',
  'created',
  'updated',
  'passwordUpdated',
  'avatarSource',
  'avatarUploaded',
  'avatarVersion',
  'member',
  'replyRate',
  'replyTime',
  'extSitesCouchers',
  'extSitesBW',
  'extSitesCS',
  'extSitesWS',
  'nostrNpub',
  'emailHash',
  'additionalProvidersData.facebook.id',
  'additionalProvidersData.twitter.screen_name',
  'additionalProvidersData.github.login',
];

/**
 * Select the fields that the profile update controller persists directly.
 * Email is handled separately by its confirmation flow.
 * @param {import('../../shared/profile.js').UpdateProfileRequest} body
 * @returns {Omit<import('../../shared/profile.js').UpdateProfileRequest, 'email'>}
 */
function selectProfileUpdateFields(body) {
  return {
    ...(Object.hasOwn(body, 'firstName') ? { firstName: body.firstName } : {}),
    ...(Object.hasOwn(body, 'lastName') ? { lastName: body.lastName } : {}),
    ...(Object.hasOwn(body, 'tagline') ? { tagline: body.tagline } : {}),
    ...(Object.hasOwn(body, 'description')
      ? { description: body.description }
      : {}),
    ...(Object.hasOwn(body, 'birthdate') ? { birthdate: body.birthdate } : {}),
    ...(Object.hasOwn(body, 'gender') ? { gender: body.gender } : {}),
    ...(Object.hasOwn(body, 'languages') ? { languages: body.languages } : {}),
    ...(Object.hasOwn(body, 'locationLiving')
      ? { locationLiving: body.locationLiving }
      : {}),
    ...(Object.hasOwn(body, 'locationFrom')
      ? { locationFrom: body.locationFrom }
      : {}),
    ...(Object.hasOwn(body, 'username') ? { username: body.username } : {}),
    ...(Object.hasOwn(body, 'extSitesCouchers')
      ? { extSitesCouchers: body.extSitesCouchers }
      : {}),
    ...(Object.hasOwn(body, 'extSitesBW')
      ? { extSitesBW: body.extSitesBW }
      : {}),
    ...(Object.hasOwn(body, 'extSitesCS')
      ? { extSitesCS: body.extSitesCS }
      : {}),
    ...(Object.hasOwn(body, 'extSitesWS')
      ? { extSitesWS: body.extSitesWS }
      : {}),
    ...(Object.hasOwn(body, 'nostrNpub') ? { nostrNpub: body.nostrNpub } : {}),
    ...(Object.hasOwn(body, 'avatarSource')
      ? { avatarSource: body.avatarSource }
      : {}),
    ...(Object.hasOwn(body, 'avatarUploaded')
      ? { avatarUploaded: body.avatarUploaded }
      : {}),
    ...(Object.hasOwn(body, 'newsletter')
      ? { newsletter: body.newsletter }
      : {}),
    ...(Object.hasOwn(body, 'locale') ? { locale: body.locale } : {}),
  };
}

/**
 * Explicitly construct the approved profile projection. Undefined optional
 * properties are omitted by Express JSON serialisation, as with the former
 * lodash pick implementation.
 *
 * @template Id, Timestamp
 * @param {import('../../shared/profile.js').OwnProfile<Id, Timestamp>} profile
 * @param {boolean} isOwnProfile
 * @returns {import('../../shared/profile.js').PublicProfile<Id, Timestamp> | import('../../shared/profile.js').OwnProfile<Id, Timestamp>}
 */
function selectProfileResponse(profile, isOwnProfile) {
  const publicProfile = {
    _id: profile._id,
    id: profile.id,
    displayName: profile.displayName,
    username: profile.username,
    gender: profile.gender,
    tagline: profile.tagline,
    description: profile.description,
    locationFrom: profile.locationFrom,
    locationLiving: profile.locationLiving,
    languages: profile.languages,
    birthdate: profile.birthdate,
    seen: profile.seen,
    created: profile.created,
    avatarSource: profile.avatarSource,
    avatarUploaded: profile.avatarUploaded,
    avatarVersion: profile.avatarVersion,
    member: profile.member,
    memberIds: profile.memberIds,
    replyRate: profile.replyRate,
    replyTime: profile.replyTime,
    extSitesCouchers: profile.extSitesCouchers,
    extSitesBW: profile.extSitesBW,
    extSitesCS: profile.extSitesCS,
    extSitesWS: profile.extSitesWS,
    nostrNpub: profile.nostrNpub,
    emailHash: profile.emailHash,
    additionalProvidersData: profile.additionalProvidersData
      ? {
          ...(profile.additionalProvidersData.facebook
            ? { facebook: { id: profile.additionalProvidersData.facebook.id } }
            : {}),
          ...(profile.additionalProvidersData.twitter
            ? {
                twitter: {
                  screen_name:
                    profile.additionalProvidersData.twitter.screen_name,
                },
              }
            : {}),
          ...(profile.additionalProvidersData.github
            ? {
                github: { login: profile.additionalProvidersData.github.login },
              }
            : {}),
        }
      : undefined,
    public: profile.public,
    isVolunteer: profile.isVolunteer,
    isVolunteerAlumni: profile.isVolunteerAlumni,
    isGreeter: profile.isGreeter,
  };

  if (!isOwnProfile) return publicProfile;

  return {
    ...publicProfile,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    emailTemporary: profile.emailTemporary,
    newsletter: profile.newsletter,
    locale: profile.locale,
    provider: profile.provider,
    blocked: profile.blocked,
    updated: profile.updated,
    passwordUpdated: profile.passwordUpdated,
    usernameUpdated: profile.usernameUpdated,
    usernameUpdateAllowed: profile.usernameUpdateAllowed,
  };
}

/**
 * Construct the restricted identity used beside messages, contacts and experiences.
 * @template Id, Timestamp
 * @param {import('../../shared/profile.js').MiniProfile<Id, Timestamp>} profile
 * @returns {import('../../shared/profile.js').MiniProfile<Id, Timestamp>}
 */
function selectMiniProfileResponse(profile) {
  return {
    _id: profile._id,
    id: profile.id,
    updated: profile.updated,
    displayName: profile.displayName,
    username: profile.username,
    avatarSource: profile.avatarSource,
    avatarUploaded: profile.avatarUploaded,
    avatarVersion: profile.avatarVersion,
    emailHash: profile.emailHash,
    additionalProvidersData: profile.additionalProvidersData
      ? {
          ...(profile.additionalProvidersData.facebook
            ? { facebook: { id: profile.additionalProvidersData.facebook.id } }
            : {}),
        }
      : undefined,
    blocked: profile.blocked,
  };
}

const service = {
  profileQueryFields,
  selectProfileUpdateFields,
  selectProfileResponse,
  selectMiniProfileResponse,
};

export {
  profileQueryFields,
  selectProfileUpdateFields,
  selectProfileResponse,
  selectMiniProfileResponse,
};
export default service;
