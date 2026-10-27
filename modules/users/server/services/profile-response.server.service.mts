import type {
  MiniProfile,
  OwnProfile,
  ProfileResponseSource,
  PublicProfile,
  ProfileMembership,
  ProfileTribe,
  UpdateProfileRequest,
} from '../../shared/profile.js';

export type ServerProfileMembership<Id, Timestamp> = Omit<
  ProfileMembership<Id, Timestamp>,
  'tribe'
> & { tribe: ProfileTribe<Id> | Id | null };

type ServerProfileResponse<Id, Timestamp> = Omit<
  OwnProfile<Id, Timestamp>,
  'displayName' | 'member'
> & {
  displayName?: string;
  member?: ServerProfileMembership<Id, Timestamp>[];
};

export type ProfileResponseDto<Id, Timestamp> = ServerProfileResponse<
  Id,
  Timestamp
>;

export type ServerPublicProfileResponse<Id, Timestamp> = Omit<
  PublicProfile<Id, Timestamp>,
  'displayName' | 'member'
> &
  Pick<OwnProfile<Id, Timestamp>, 'public'> & {
    displayName?: string;
    member?: ServerProfileMembership<Id, Timestamp>[];
  };

export const profileQueryFields = [
  'id',
  'displayName',
  'username',
  'gender',
  'tagline',
  'description',
  'locationFrom',
  'locationLiving',
  'languages',
  'languageLevels',
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
  'extSitesServas',
  'nostrNpub',
  'emailHash',
  'additionalProvidersData.facebook.id',
  'additionalProvidersData.twitter.screen_name',
  'additionalProvidersData.github.login',
];

/**
 * Select the fields that the profile update controller persists directly.
 * Email is handled separately by its confirmation flow.
 */
export function selectProfileUpdateFields(
  body: Partial<UpdateProfileRequest> | Record<string, unknown>,
): Partial<Record<Exclude<keyof UpdateProfileRequest, 'email'>, unknown>> {
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
    ...(Object.hasOwn(body, 'languageLevels')
      ? { languageLevels: body.languageLevels }
      : {}),
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
    ...(Object.hasOwn(body, 'extSitesServas')
      ? { extSitesServas: body.extSitesServas }
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
 */
export function selectProfileResponse<Id, Timestamp>(
  profile: ProfileResponseSource<Id, Timestamp>,
  isOwnProfile: true,
): ServerProfileResponse<Id, Timestamp>;
export function selectProfileResponse<Id, Timestamp>(
  profile: ProfileResponseSource<Id, Timestamp>,
  isOwnProfile: false,
): ServerPublicProfileResponse<Id, Timestamp>;
export function selectProfileResponse<Id, Timestamp>(
  profile: ProfileResponseSource<Id, Timestamp>,
  isOwnProfile: boolean,
):
  | ServerProfileResponse<Id, Timestamp>
  | ServerPublicProfileResponse<Id, Timestamp>;
export function selectProfileResponse<Id, Timestamp>(
  profile: ProfileResponseSource<Id, Timestamp>,
  isOwnProfile: boolean,
):
  | ServerProfileResponse<Id, Timestamp>
  | ServerPublicProfileResponse<Id, Timestamp> {
  const publicProfile: ServerPublicProfileResponse<Id, Timestamp> = {
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
    languageLevels: profile.languageLevels,
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
    extSitesServas: profile.extSitesServas,
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

/** Construct the restricted identity used beside messages, contacts and experiences. */
export function selectMiniProfileResponse<Id, Timestamp>(
  profile: MiniProfile<Id, Timestamp>,
): MiniProfile<Id, Timestamp> {
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

export default service;
