import _ from 'lodash';

const { pick } = _;

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
  'birthdate',
  'seen',
  'created',
  'updated',
  'passwordUpdated',
  'avatarSource',
  'avatarUploaded',
  'member',
  'replyRate',
  'replyTime',
  'extSitesCouchers', // BeWelcome username
  'extSitesBW', // BeWelcome username
  'extSitesCS', // CouchSurfing username
  'extSitesWS', // WarmShowers username
  'nostrNpub', // nostr npub
  'emailHash', // MD5 hashed email to use with Gravatars
  'additionalProvidersData.facebook.id', // For FB avatars and profile links
  'additionalProvidersData.twitter.screen_name', // For Twitter profile links
  'additionalProvidersData.github.login', // For GitHub profile links
];

const publicFields = profileQueryFields
  .filter(field => !['updated', 'passwordUpdated'].includes(field))
  .concat(['_id', 'public', 'memberIds', 'isVolunteer', 'isVolunteerAlumni']);

const ownFields = publicFields.concat([
  'firstName',
  'lastName',
  'email',
  'emailTemporary',
  'newsletter',
  'locale',
  'provider',
  'blocked',
  'updated',
  'passwordUpdated',
  'usernameUpdated',
  'usernameUpdateAllowed',
]);

/** Publish only approved fields, including minimal legacy provider identities. */
export function selectProfileResponse(profile, isOwnProfile) {
  return pick(profile, isOwnProfile ? ownFields : publicFields);
}
