import type { Connection, HydratedDocument, Model, Types } from 'mongoose';

/** Authentication credentials passed through API test helpers. */
export interface Credentials {
  username: string;
  password: string;
}

/** User fields used by server model and API tests. */
export interface UserRecord {
  firstName: string;
  lastName: string;
  displayName?: string;
  email: string;
  emailTemporary?: string;
  emailToken?: string;
  emailTokenIssuedAt?: Date;
  emailTokenExpires?: Date;
  emailHash?: string;
  username: string;
  usernameUpdated?: Date;
  usernameHistory?: Array<{
    oldUsername: string;
    newUsername: string;
    changedAt: Date;
  }>;
  seen?: Date;
  lastIpAddress?: string;
  created?: Date;
  password?: string;
  salt?: string;
  authVersion?: number;
  resetPasswordToken?: string;
  removeProfileToken?: string;
  removeProfileExpires?: Date;
  provider?: string;
  providerData?: Record<string, unknown> | Array<Record<string, unknown>>;
  roles?: string[];
  public?: boolean;
  locale?: string;
  newsletter?: boolean;
  publicReminderCount?: number;
  acquisitionStory?: string;
  extSitesCouchers?: string;
  extSitesBW?: string;
  extSitesCS?: string;
  extSitesWS?: string;
  extSitesServas?: string;
  avatarSource?: string;
  avatarUploaded?: boolean;
  avatarVersion?: string;
  blocked?: Types.ObjectId[];
  additionalProvidersData?: {
    facebook?: { id?: string };
    github?: { login?: string };
    twitter?: { screen_name?: string };
  };
  tagline?: string;
  description?: string;
  languages?: string[];
  locationLiving?: string;
  locationFrom?: string;
  member?: Array<{ tribe: Types.ObjectId; since?: Date }>;
  nostrNpub?: string;
}

interface UserMethods {
  authenticate(password: string): Promise<boolean>;
  hashPassword(password: string): Promise<string>;
}

export interface UserStatics {
  hashPassword(password: string): Promise<string>;
  isValidPassword(password: string): boolean;
}

export type UserModel = Model<UserRecord, Record<string, never>, UserMethods> &
  UserStatics;
export type UserModelDocument = HydratedDocument<UserRecord, UserMethods>;
/** The filter/update overload used by controller and job update stubs. */
export type UserUpdateOne = (
  filter: import('mongoose').QueryFilter<UserRecord>,
  update: import('mongoose').UpdateQuery<UserRecord>,
  options?: import('mongoose').QueryOptions<UserRecord>,
) => ReturnType<UserModel['updateOne']>;
export type UserDocument =
  import('./data.server.testutil.mts').UserFixtureDocument;
export type ContactDocument = HydratedDocument<ContactRecord>;
export type ExperienceDocument = HydratedDocument<ExperienceRecord>;
export type MessageDocument = HydratedDocument<MessageRecord>;
export type MessageStatDocument = HydratedDocument<MessageStatRecord>;
export type OfferDocument = HydratedDocument<OfferRecord>;
export type TribeDocument = HydratedDocument<TribeRecord>;
export type ReferenceThreadDocument = HydratedDocument<ReferenceThreadRecord>;
export type TestExpressApp = import('express').Express;
export type TestAgent = import('supertest').Agent;
export type TestExpressModule =
  typeof import('../../config/lib/express.mjs').default & {
    init(connection: Connection): Promise<TestExpressApp>;
  };
export type TestConfigModule =
  typeof import('../../config/config.mts').default & {
    illegalStrings: string[];
  };
export type ContactModel = Model<ContactRecord>;
export type ExperienceModel = Model<ExperienceRecord>;
export type MessageModel = Model<MessageRecord>;
export type ThreadModel = Model<ThreadRecord>;
export type MessageStatModel = Model<MessageStatRecord>;
export type OfferModel = Model<OfferRecord>;
export type TribeModel = Model<TribeRecord>;
export type ReferenceThreadModel = Model<ReferenceThreadRecord>;

/** Small query surface for controller tests that replace Mongo query chains. */
export interface TestQuery<T> {
  sort(...args: unknown[]): TestQuery<T>;
  limit(value: number): TestQuery<T>;
  populate(...args: unknown[]): TestQuery<T>;
  exec(): Promise<T>;
}

/** Contact relationship fields persisted by the Contact schema. */
export interface ContactRecord {
  created: Date;
  confirmed: boolean;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
}

/** Experience feedback fields persisted by the Experience schema. */
export interface ExperienceRecord {
  created?: Date;
  public?: boolean;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  interactions?: { met?: boolean; guest?: boolean; host?: boolean };
  recommend?: 'yes' | 'no' | 'unknown';
  feedbackPublic?: string;
  removedAt?: Date;
  removedBy?: Types.ObjectId;
}

/** Message fields used by message and unread-notification tests. */
export interface MessageRecord {
  created?: Date;
  content?: string;
  userFrom?: Types.ObjectId;
  userTo?: Types.ObjectId;
  read?: boolean;
  spam?: boolean;
  shadowHidden?: boolean;
  notificationCount?: number;
  locationCorrectionKey?: string;
  locationCorrectionOffers?: Array<{
    offer?: Types.ObjectId;
    location?: number[];
  }>;
}

/** Conversation thread fields. */
export interface ThreadRecord {
  updated?: Date;
  userFrom?: Types.ObjectId;
  userTo?: Types.ObjectId;
  message?: Types.ObjectId;
  read?: boolean;
}

/** Message statistics keyed by the first message's sender and recipient. */
export interface MessageStatRecord {
  firstMessageUserFrom?: Types.ObjectId;
  firstMessageUserTo?: Types.ObjectId;
  firstMessageCreated?: Date;
  firstMessageLength?: number;
  firstReplyCreated?: Date | null;
  firstReplyLength?: number | null;
  timeToFirstReply?: number | null;
}

/** Payload emitted by the message statistics processor before it is stored. */
export interface MessageStatsPoint {
  namespace: 'messages';
  counts: { sent: 1 };
  values: { timeToFirstReply?: number };
  tags: {
    spam: 'yes' | 'no' | 'unknown';
    position: 'first' | 'firstReply' | 'other';
    messageLengthType: 'short' | 'long';
  };
  meta: {
    messageId: string;
    userFrom: string;
    userTo: string;
    messageLength: number;
  };
  time: Date;
}

/** Offer fields used by offer model and route tests. */
export interface OfferRecord {
  type?: 'host' | 'meet';
  status?: 'yes' | 'maybe' | 'no';
  description?: string;
  noOfferDescription?: string;
  maxGuests?: number;
  location: number[];
  locationFuzzy?: number[];
  updated?: Date;
  createdAt?: Date;
  validUntil?: Date;
  user?: Types.ObjectId;
  reactivateReminderSent?: Date;
  showOnlyInMyCircles?: boolean;
}

/** Circle fields persisted by the Tribe schema. */
export interface TribeRecord {
  label: string;
  /** Legacy route fixtures pass this field; the Tribe schema ignores it. */
  tribe?: boolean;
  labelHistory?: string[];
  slugHistory?: string[];
  slug?: string;
  synonyms?: string[];
  color?: string;
  count?: number;
  created?: Date;
  modified?: Date;
  public?: boolean;
  image?: boolean;
  attribution?: string;
  attribution_url?: string;
  description?: string;
}

/** Reference decision attached to a conversation between two members. */
export interface ReferenceThreadRecord {
  thread: Types.ObjectId;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  reference: 'yes' | 'no';
  created?: Date;
}
