import type { HydratedDocument, Model, Types } from 'mongoose';

export interface UserMemberRecord {
  tribe: Types.ObjectId;
  since: Date;
}

export interface UserPushRegistrationRecord {
  platform: 'android' | 'ios' | 'web' | 'expo';
  token: string;
  created: Date;
  deviceId?: string;
}

export interface UsernameHistoryRecord {
  oldUsername: string;
  newUsername: string;
  changedAt: Date;
}

export interface UserProviderData {
  facebook?: { id?: string };
  twitter?: { screen_name?: string };
  github?: { id?: string; login?: string };
  [provider: string]: unknown;
}

export interface UserServerRecord {
  _id: Types.ObjectId;
  firstName: string;
  lastName?: string;
  displayName?: string;
  email: string;
  emailTemporary?: string;
  emailHash?: string;
  username: string;
  usernameUpdated?: Date;
  usernameHistory?: UsernameHistoryRecord[];
  tagline?: string;
  description?: string;
  birthdate?: Date;
  gender?: '' | 'female' | 'male' | 'non-binary' | 'other';
  languages?: string[];
  locationLiving?: string;
  locationFrom?: string;
  extSitesCouchers?: string;
  extSitesBW?: string;
  extSitesCS?: string;
  extSitesWS?: string;
  extSitesServas?: string;
  nostrNpub?: string;
  password?: string;
  salt?: string;
  authVersion?: number;
  provider: string;
  providerData?: Record<string, unknown>;
  additionalProvidersData?: UserProviderData;
  roles: string[];
  seen?: Date;
  lastIpAddress?: string;
  updated?: Date;
  created?: Date;
  avatarSource?: 'none' | 'gravatar' | 'local' | 'facebook';
  avatarUploaded?: boolean;
  avatarVersion?: string;
  newsletter?: boolean;
  locale?: string;
  passwordUpdated?: Date;
  emailToken?: string;
  emailTokenIssuedAt?: Date;
  emailTokenExpires?: Date;
  public?: boolean;
  publicReminderCount?: number;
  publicReminderSent?: Date;
  welcomeSequenceSent?: Date;
  welcomeSequenceStep?: number;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date | number;
  removeProfileToken?: string;
  removeProfileExpires?: Date;
  member: UserMemberRecord[];
  pushRegistration: UserPushRegistrationRecord[];
  blocked: Types.ObjectId[];
  acquisitionStory?: string;
}

export interface UserServerMethods {
  authenticate(password: unknown): Promise<boolean>;
  hashPassword(password: string): Promise<string>;
}

export interface UserServerStatics {
  hashPassword(password: string): Promise<string>;
  isValidPassword(password: unknown): password is string;
}

export type UserServerModel = Model<
  UserServerRecord,
  Record<string, never>,
  UserServerMethods
> &
  UserServerStatics;

export type UserServerDocument = HydratedDocument<
  UserServerRecord,
  UserServerMethods
>;
