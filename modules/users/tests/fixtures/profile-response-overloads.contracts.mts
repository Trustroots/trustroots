import type { OwnProfile } from '../../shared/profile.js';
import { selectProfileResponse } from '../../server/services/profile-response.server.service.mts';

const profile: OwnProfile = {
  _id: 'fictional-user-id',
  username: 'fictional-member',
  displayName: 'Fictional Member',
  email: 'member@example.test',
  blocked: ['fictional-blocked-id'],
};

const ownProfile = selectProfileResponse(profile, true);
void ownProfile.email;
void ownProfile.blocked;

const publicProfile = selectProfileResponse(profile, false);
void publicProfile.username;
// @ts-expect-error Public responses must not expose account-only fields.
void publicProfile.email;
// @ts-expect-error Public responses must not expose block lists.
void publicProfile.blocked;

const isOwnProfile = Math.random() > 0.5;
const conditionalProfile = selectProfileResponse(profile, isOwnProfile);
void conditionalProfile.username;
// @ts-expect-error A runtime boolean does not guarantee an own profile.
void conditionalProfile.email;
