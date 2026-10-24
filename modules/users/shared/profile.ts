import type { LanguageLevels } from './language-levels.js';

/** A tribe membership included in a full member profile. */
export interface ProfileTribe<Id = string> {
  _id: Id;
  slug: string;
  label: string;
  count: number;
  image?: string;
  color?: string;
}

export interface ProfileMembership<Id = string, Timestamp = string> {
  tribe: ProfileTribe<Id>;
  since?: Timestamp;
}

/** Public Facebook identifier retained for the member's profile avatar. */
export interface FacebookProviderIdentity {
  id?: string;
}

/** Public Twitter identifier retained for a profile link. */
export interface TwitterProviderIdentity {
  screen_name?: string;
}

/** Public GitHub identifier retained for a profile link. */
export interface GithubProviderIdentity {
  login?: string;
}

export type PublicProviderIdentity =
  FacebookProviderIdentity | TwitterProviderIdentity | GithubProviderIdentity;

export interface PublicProviderIdentities {
  facebook?: FacebookProviderIdentity;
  twitter?: TwitterProviderIdentity;
  github?: GithubProviderIdentity;
}

/** Fields returned for another member after profile privacy filtering. */
export interface PublicProfile<Id = string, Timestamp = string> {
  _id: Id;
  id?: Id;
  displayName: string;
  username: string;
  gender?: string;
  tagline?: string;
  description?: string;
  locationFrom?: string;
  locationLiving?: string;
  languages?: string[];
  languageLevels?: LanguageLevels;
  birthdate?: Timestamp | null;
  seen?: Timestamp;
  created?: Timestamp;
  avatarSource?: string;
  avatarUploaded?: boolean;
  avatarVersion?: string;
  member?: ProfileMembership<Id, Timestamp>[];
  memberIds?: string[];
  replyRate?: string;
  replyTime?: string;
  extSitesCouchers?: string;
  extSitesBW?: string;
  extSitesCS?: string;
  extSitesWS?: string;
  extSitesServas?: string;
  nostrNpub?: string;
  emailHash?: string;
  additionalProvidersData?: PublicProviderIdentities;
  isVolunteer?: boolean;
  isVolunteerAlumni?: boolean;
  isGreeter?: boolean;
}

/** Additional account-only fields returned to the member who owns the profile. */
export interface OwnProfile<
  Id = string,
  Timestamp = string,
> extends PublicProfile<Id, Timestamp> {
  public?: boolean;
  firstName?: string;
  lastName?: string;
  email?: string;
  emailTemporary?: string;
  newsletter?: boolean;
  locale?: string;
  provider?: string;
  blocked?: Id[];
  updated?: Timestamp;
  passwordUpdated?: Timestamp;
  usernameUpdated?: Timestamp;
  usernameUpdateAllowed?: boolean;
}

/** Fields the profile response selector reads from a sanitised projection. */
export type ProfileResponseSource<Id = string, Timestamp = string> = Omit<
  Partial<OwnProfile<Id, Timestamp>>,
  'displayName' | 'member'
> & {
  _id: Id;
  username: string;
  displayName?: string;
  member?: Array<
    Omit<ProfileMembership<Id, Timestamp>, 'tribe'> & {
      tribe: ProfileTribe<Id> | Id | null;
    }
  >;
};

/** Restricted identity shown beside messages, contacts, and experiences. */
export interface MiniProfile<Id = string, Timestamp = string> {
  _id: Id;
  id?: Id;
  updated?: Timestamp;
  displayName?: string;
  username: string;
  avatarSource?: string;
  avatarUploaded?: boolean;
  avatarVersion?: string;
  emailHash?: string;
  additionalProvidersData?: Pick<PublicProviderIdentities, 'facebook'>;
  blocked?: Id[];
}

/** Fields accepted by PUT /api/users. Values are still validated by the server. */
export interface UpdateProfileRequest {
  firstName?: string;
  /** Empty string clears the surname. */
  lastName?: string;
  tagline?: string;
  description?: string;
  birthdate?: string | null;
  gender?: string;
  languages?: string[];
  languageLevels?: LanguageLevels;
  locationLiving?: string;
  locationFrom?: string;
  username?: string;
  extSitesCouchers?: string;
  extSitesBW?: string;
  extSitesCS?: string;
  extSitesWS?: string;
  extSitesServas?: string;
  nostrNpub?: string;
  avatarSource?: string;
  avatarUploaded?: boolean;
  newsletter?: boolean;
  locale?: string;
  /** Empty string clears the email; a new address starts confirmation. */
  email?: string;
}
