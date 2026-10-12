import type {
  MiniProfile,
  OwnProfile,
  ProfileMembership,
} from '../shared/profile.js';

export type TribeMembership = ProfileMembership;

/** Profile data held by the client, including bootstrap-only role information. */
export interface UserProfile extends OwnProfile {
  name?: string;
  lastSeen?: string;
  roles?: string[];
  subscriptions?: Record<string, boolean>;
  networks?: Record<string, string>;
  profile?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Own-profile response with the client compatibility fields used by auth state. */
export type ClientOwnProfile = UserProfile;

export type UserSummary = Pick<
  MiniProfile,
  '_id' | 'username' | 'displayName'
> & {
  avatar?: string;
  avatarSource?: string;
  avatarUploaded?: boolean;
  avatarVersion?: string;
  updated?: string;
  emailHash?: string;
  additionalProvidersData?: MiniProfile['additionalProvidersData'];
};
