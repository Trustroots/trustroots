import { validLanguageLevels } from '../../shared/language-levels.ts';
import _ from 'lodash';
import textService from '../../../core/server/services/text.server.service.mjs';
import { readFileSync } from 'node:fs';
import authenticationService from '../services/authentication.server.service.mjs';
import passwordHashing from '../services/password-hashing.server.service.mjs';
import crypto from 'crypto';
import mongoose, { type QueryFilter } from 'mongoose';
import uniqueValidation from '../../../../config/lib/mongoose-unique-validation.mjs';
import validator from 'validator';
import type {
  UserServerDocument,
  UserServerModel,
  UserServerRecord,
} from './user.server.types.mts';
import {
  captureConnectionSnapshot,
  clearConnectionHistoryCas,
  trackConnectionHistoryBeforeSave,
} from '../services/connection-history.server.service.mts';
import type { ConnectionHistoryEntry } from '../../shared/network-connections.js';
/**
 * Module dependencies.
 */
const languages = JSON.parse(
  readFileSync(
    new URL('../../../../config/languages/languages.json', import.meta.url),
    'utf8',
  ),
);
const Schema = mongoose.Schema;

const passwordMinLength = 8;

/**
 * A Validation function for local strategy properties
 */
const validateLocalStrategyProperty = function (
  this: UserServerDocument,
  property: string,
): boolean {
  return (this.provider !== 'local' && !this.updated) || property.length > 0;
};

/**
 * A Validation function for local strategy email
 */
const validateLocalStrategyEmail = function (
  this: UserServerDocument,
  email: string,
): boolean {
  return (
    (this.provider !== 'local' && !this.updated) || validator.isEmail(email)
  );
};

/**
 * A Validation function for password
 */
const validatePassword = function (password: unknown): password is string {
  return Boolean(password && validator.isLength(password, passwordMinLength));
};

/**
 * Enforce selection policy on new/changed identities only. Unrelated saves must
 * preserve legacy and newly reserved usernames; requiredness and uniqueness
 * remain enforced by the schema.
 */
const validateUsername = function (
  this: UserServerDocument,
  username: string,
): boolean {
  return (
    (!this.isNew && !this.isModified('username')) ||
    authenticationService.validateUsername(username)
  );
};

const setPlainTextField = function (value: string): string {
  return textService.plainText(value, true);
};

const setPlainTextFieldAndLimit = function (limit: number) {
  return function (value: string): string {
    return setPlainTextField(value).substring(0, limit);
  };
};

/**
 * SubSchema for `User` schema's `member` array
 * This could be defined directly under `UserSchema` as well,
 * but then we'd have extra `_id`'s hanging around.
 */
const UserMemberSchema = new Schema<UserServerRecord['member'][number]>(
  {
    tribe: {
      type: Schema.Types.ObjectId,
      ref: 'Tribe',
      required: true,
    },
    since: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false },
);

/**
 * SubSchema for `User` schema's `pushRegistration` array.
 *
 * Push delivery is retired. Keep historical values valid so existing profiles
 * load and tokens can still be removed. New registrations are rejected in the
 * profile controller; restore a sender before accepting writes again.
 */
const UserPushRegistrationSchema = new Schema<
  UserServerRecord['pushRegistration'][number]
>(
  {
    platform: {
      type: String,
      // Historical platforms: android/ios/web (FCM) and expo (Exponent).
      enum: ['android', 'ios', 'web', 'expo'],
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    created: {
      type: Date,
      default: Date.now,
      required: true,
    },
    deviceId: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const UsernameHistorySchema = new Schema<
  NonNullable<UserServerRecord['usernameHistory']>[number]
>(
  {
    oldUsername: { type: String, required: true },
    newUsername: { type: String, required: true },
    changedAt: { type: Date, required: true },
  },
  { _id: false },
);

const ConnectionHistorySchema = new Schema<ConnectionHistoryEntry>(
  {
    network: {
      type: String,
      enum: [
        'couchers',
        'bewelcome',
        'couchsurfing',
        'warmshowers',
        'servas',
        'nostr',
        'facebook',
        'twitter',
        'github',
      ],
      required: true,
    },
    oldIdentifier: { type: String, default: null },
    newIdentifier: { type: String, default: null },
    changedAt: { type: Date, default: null },
    initial: { type: Boolean, required: true },
  },
  { _id: false },
);

/**
 * User Schema
 */
const UserSchema = new Schema<
  UserServerRecord,
  UserServerModel,
  import('./user.server.types.mts').UserServerMethods,
  Record<string, never>,
  Record<string, never>,
  import('./user.server.types.mts').UserServerStatics
>({
  firstName: {
    type: String,
    required: true,
    validate: [
      validateLocalStrategyProperty,
      'Please fill in your first name.',
    ],
    set: setPlainTextField,
  },
  lastName: {
    type: String,
    required: false,
    set: setPlainTextField,
  },
  /* This is generated in Schema pre-save hook below */
  displayName: {
    type: String,
  },
  email: {
    type: String,
    trim: true,
    unique: true,
    lowercase: true,
    required: true,
    validate: [
      validateLocalStrategyEmail,
      'Please fill a valid email address.',
    ],
  },
  /* New email is stored here until it is confirmed */
  emailTemporary: {
    type: String,
    trim: true,
    lowercase: true,
    default: '',
    validate: [
      (email: string) => !email || validator.isEmail(email),
      'Please enter a valid email address.',
    ],
  },
  tagline: {
    type: String,
    default: '',
    set: setPlainTextField,
  },
  description: {
    type: String,
    default: '',
    set: textService.html,
  },
  birthdate: {
    type: Date,
  },
  gender: {
    type: String,
    enum: ['', 'female', 'male', 'non-binary', 'other'],
    default: '',
  },
  languages: {
    type: [
      {
        type: String,
        enum: _.keys(languages),
      },
    ],
    default: [],
  },
  languageLevels: {
    type: Object,
    default: {},
    validate: {
      validator(this: UserServerDocument, value: unknown) {
        return validLanguageLevels(value, this.languages || []);
      },
      message: 'Please select valid levels for your profile languages.',
    },
  },
  locationLiving: {
    type: String,
    set: setPlainTextField,
  },
  locationFrom: {
    type: String,
    set: setPlainTextField,
  },
  // Lowercase enforced username
  username: {
    type: String,
    unique: true,
    required: true,
    validate: [validateUsername, authenticationService.usernameFormatMessage],
    lowercase: true, // Stops users creating case sensitive duplicate usernames with "username" and "USERname", via @link https://github.com/meanjs/mean/issues/147
    trim: true,
  },
  usernameUpdated: {
    type: Date,
  },
  usernameHistory: {
    type: [UsernameHistorySchema],
    select: false,
  },
  // Couchers.org username
  extSitesCouchers: {
    type: String,
    trim: true,
    set: setPlainTextField,
  },
  // Bewelcome.org username
  extSitesBW: {
    type: String,
    trim: true,
    set: setPlainTextField,
  },
  // Couchsurfing.com username
  extSitesCS: {
    type: String,
    trim: true,
    set: setPlainTextField,
  },
  // Warmshowers.org username
  extSitesWS: {
    type: String,
    trim: true,
    set: setPlainTextField,
  },
  // Servas profile path (household or address)
  extSitesServas: {
    type: String,
    trim: true,
    match: [
      /^(?:(?:household|address)\/[^\s?#\\]+)?$/,
      'Please provide a Servas household/ or address/ profile path.',
    ],
  },
  // nostr npub
  nostrNpub: {
    type: String,
    trim: true,
    lowercase: true,
    set: setPlainTextField,
  },
  // Private external identity history is selected only by staff tooling.
  connectionHistory: {
    type: [ConnectionHistorySchema],
    default: undefined,
    select: false,
  },
  connectionSearchKeys: {
    type: [String],
    default: undefined,
    select: false,
  },
  connectionHistoryInitialised: { type: Boolean, select: false },
  connectionHistoryRevision: { type: Number, select: false },
  password: {
    type: String,
    default: '',
    validate: [
      validatePassword,
      'Password should be more than ' + passwordMinLength + ' characters long.',
    ],
  },
  emailHash: {
    type: String,
  },
  salt: {
    type: String,
  },
  /* All this provider stuff relates to oauth logins, will always be local for
     Trustroots, comes from boilerplate. Will be removed one day. */
  provider: {
    type: String,
    required: true,
    default: 'local',
  },
  /* Facebook, Twitter etc data is stored here. */
  providerData: {},
  additionalProvidersData: {},
  roles: {
    type: [
      {
        type: String,
        enum: [
          'admin',
          'welcome-team',
          'support-team',
          'moderator',
          'shadowban',
          'suspended',
          'user',
          'volunteer-alumni',
          'volunteer',
        ],
      },
    ],
    default: ['user'],
  },
  /* The last time the user was logged in; collected from July 2017 onwards */
  seen: {
    type: Date,
  },
  // The current client IP address from authenticated activity; no history is kept.
  lastIpAddress: {
    type: String,
    index: true,
  },
  updated: {
    type: Date,
  },
  created: {
    type: Date,
    default: Date.now,
  },
  avatarSource: {
    type: String,
    enum: ['none', 'gravatar', 'local'],
    default: 'none',
  },
  avatarUploaded: {
    type: Boolean,
    default: false,
  },
  avatarVersion: {
    type: String,
  },
  newsletter: {
    type: Boolean,
    default: false,
  },
  /* Preferred interface language (client, emails, ...) */
  locale: {
    type: String,
    default: '',
  },
  passwordUpdated: {
    type: Date,
  },
  // Incremented when credentials or account privileges change so sessions
  // established before the change can be invalidated.
  authVersion: {
    type: Number,
    default: 0,
  },
  /* For email confirmations */
  emailToken: {
    type: String,
  },
  emailTokenIssuedAt: {
    type: Date,
  },
  emailTokenExpires: {
    type: Date,
  },
  /* New users are public=false until they validate their email. If public=false,
     users can't email other users, can't be seen by other users. They are
     effectively black holed... */
  public: {
    type: Boolean,
    default: false,
  },
  /* Count and latest date of emails sent to remind about un-finished signup
     Will be removed once user sets `public:true` */
  publicReminderCount: {
    type: Number,
  },
  publicReminderSent: {
    type: Date,
  },
  welcomeSequenceSent: {
    type: Date,
  },
  // Count on which welcome sequence step (onboarding emails) user is at
  welcomeSequenceStep: {
    type: Number,
    default: 0,
  },
  /* For reset password */
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  },
  /* For removing the profile */
  removeProfileToken: {
    type: String,
  },
  removeProfileExpires: {
    type: Date,
  },
  /* Tribes user is member of */
  member: {
    type: [UserMemberSchema],
    default: [],
  },
  pushRegistration: {
    type: [UserPushRegistrationSchema],
    default: [],
  },
  blocked: {
    type: [Schema.Types.ObjectId],
    ref: 'User',
    default: [],
  },
  acquisitionStory: {
    type: String,
    default: '',
    set: setPlainTextFieldAndLimit(500),
  },
});

// The duplicate-value plugin reads these messages from the unique schema
// options before normalising them to Mongoose's boolean option.
Object.assign(UserSchema.path('email').options, {
  unique: 'Account with this email exists already.',
});
Object.assign(UserSchema.path('username').options, {
  unique: 'Username exists already.',
});

// Interpret retired selections without requiring a database migration. This
// also keeps legacy accounts valid when saving unrelated profile changes.
const UserSchemaWithInitHook = UserSchema as unknown as {
  pre(
    method: 'init',
    callback: (
      this: UserServerDocument,
      data: { avatarSource?: string },
    ) => void,
  ): unknown;
};
UserSchemaWithInitHook.pre('init', function (data) {
  if (data.avatarSource === 'facebook') data.avatarSource = 'none';
});

UserSchema.post('init', function (user: UserServerDocument) {
  captureConnectionSnapshot(user);
});

UserSchema.post('save', function (user: UserServerDocument) {
  clearConnectionHistoryCas(user);
  captureConnectionSnapshot(user);
});

/**
 * Hook a pre save method to hash the password
 */
UserSchema.pre('save', async function (this: UserServerDocument) {
  async function prepare(user: UserServerDocument) {
    await trackConnectionHistoryBeforeSave(user);
    if (
      user.password &&
      user.isModified('password') &&
      user.password.length >= passwordMinLength
    ) {
      // Always treat modified input as plaintext, including strings that look
      // like a tagged password hash supplied by a client.
      user.password = await passwordHashing.hashPassword(user.password);
      user.salt = undefined;
    }

    // Pre-cached email hash to use with Gravatar
    if (user.email && user.isModified('email') && user.email !== '') {
      user.emailHash = crypto
        .createHash('md5')
        .update(user.email.trim().toLowerCase())
        .digest('hex');
    }

    // Generate `displayName`
    if (user.isModified('firstName') || user.isModified('lastName')) {
      user.displayName = [user.firstName, user.lastName]
        .filter((name): name is string => Boolean(name?.trim()))
        .map(name => name.trim())
        .join(' ');
    }
  }

  await prepare(this);
});

/**
 * Create static helper for hashing a plaintext password
 */
UserSchema.statics.hashPassword = passwordHashing.hashPassword;

UserSchema.statics.isValidPassword = validatePassword;

UserSchema.methods.hashPassword = function (password: string) {
  const model = this.constructor as UserServerModel;
  return model.hashPassword(password);
};

/**
 * Create instance method for authenticating user
 */
UserSchema.methods.authenticate = async function (password: unknown) {
  const model = this.constructor as UserServerModel;
  const candidate = typeof password === 'string' ? password : '';
  const oldPassword = this.password;
  const oldSalt = this.salt;
  const verification = await passwordHashing.verifyPassword(
    candidate,
    oldPassword,
    oldSalt,
  );
  if (!verification.valid) return false;
  if (!verification.needsRehash) return true;

  const newPassword = await passwordHashing.hashPassword(candidate);
  const filter: QueryFilter<UserServerRecord> = {
    _id: this._id,
    password: oldPassword,
  };
  // Existing records may have no stored version while Mongoose supplies the
  // schema default of zero. Match either representation for the CAS.
  if (this.authVersion === undefined || this.authVersion === 0) {
    filter.$or = [
      { authVersion: { $exists: false } },
      { authVersion: this.authVersion ?? 0 },
    ];
  } else {
    filter.authVersion = this.authVersion;
  }
  if (oldSalt === undefined) {
    filter.salt = { $exists: false };
  } else {
    filter.salt = oldSalt;
  }

  const result = await model
    .updateOne(filter, {
      $set: { password: newPassword },
      $unset: { salt: 1 },
    })
    .exec();
  const matchedCount =
    result.matchedCount ??
    ('n' in result && typeof result.n === 'number' ? result.n : undefined);
  if (matchedCount === 1) {
    this.password = newPassword;
    this.salt = undefined;
    return true;
  }

  // Another request may already have upgraded the same password, or a
  // concurrent reset/change may have replaced it. Re-check stored
  // credentials so concurrent upgrades succeed and true password changes fail.
  const fresh = await model
    .findById(this._id)
    .select('password salt')
    .lean()
    .exec();
  if (!fresh) return false;

  const retry = await passwordHashing.verifyPassword(
    candidate,
    fresh.password,
    fresh.salt,
  );
  if (!retry.valid) return false;

  this.password = fresh.password;
  this.salt = fresh.salt;
  return true;
};

/**
 * Convert duplicate unique values into field validation errors.
 */
UserSchema.plugin(uniqueValidation);

UserSchema.index(
  { 'usernameHistory.changedAt': -1 },
  { name: 'username_history_changed_at' },
);
UserSchema.index({ usernameUpdated: -1 }, { name: 'username_updated' });
UserSchema.index(
  { nostrNpub: 1 },
  {
    unique: true,
    partialFilterExpression: { nostrNpub: { $type: 'string', $gt: '' } },
  },
);
UserSchema.index(
  { connectionSearchKeys: 1 },
  { name: 'user_connection_search_keys' },
);
UserSchema.index(
  {
    username: 'text',
    firstName: 'text',
    lastName: 'text',
    locationLiving: 'text',
    locationFrom: 'text',
    tagline: 'text',
  },
  {
    weights: {
      username: 10,
      firstName: 8,
      lastName: 8,
      locationLiving: 4,
      locationFrom: 2,
      tagline: 1,
    },
  },
);
UserSchema.index(
  {
    'member.tribe': 1,
    seen: -1,
    _id: 1,
  },
  { name: 'circle_discovery_member_seen' },
);
export function registerUserModel(): UserServerModel {
  return mongoose.model<UserServerRecord, UserServerModel>('User', UserSchema);
}
