export interface TribeMembership {
  tribe: {
    _id: string;
    slug: string;
    label: string;
    count: number;
    image?: string;
    color?: string;
  };
}

export interface UserProfile {
  _id: string;
  username: string;
  displayName: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  tagline?: string;
  description?: string;
  emailTemporary?: string;
  public?: boolean;
  isVolunteer?: boolean;
  isVolunteerAlumni?: boolean;
  member?: TribeMembership[];
  memberIds?: string[];
  blocked?: string[];
  email?: string;
  gender?: string;
  birthdate?: string;
  created?: string;
  updated?: string;
  lastSeen?: string;
  seen?: string;
  avatarSource?: string;
  avatarUploaded?: boolean;
  roles?: string[];
  replyRate?: number;
  replyTime?: number;
  nostrNpub?: string;
  emailHash?: string;
  subscriptions?: Record<string, boolean>;
  extSitesCouchers?: string;
  extSitesBW?: string;
  extSitesCS?: string;
  extSitesWS?: string;
  locationLiving?: string;
  locationFrom?: string;
  languages?: string[];
  additionalProvidersData?: Record<
    string,
    Record<string, string | number | undefined>
  >;
  networks?: Record<string, string>;
  profile?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UserSummary
  extends Pick<UserProfile, '_id' | 'username' | 'displayName'> {
  avatar?: string;
}
