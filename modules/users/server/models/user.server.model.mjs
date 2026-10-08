import _ from 'lodash';
import textService from '../../../core/server/services/text.server.service.mjs';
import { readFileSync } from 'node:fs';
import authenticationService from '../services/authentication.server.service.mjs';
import passwordHashing from '../services/password-hashing.server.service.mjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import uniqueValidation from '../../../../config/lib/mongoose-unique-validation.mjs';
import validator from 'validator';
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
const validateLocalStrategyProperty = function (property) {
  return (this.provider !== 'local' && !this.updated) || property.length;
};

/**
 * A Validation function for local strategy email
 */
const validateLocalStrategyEmail = function (email) {
  return (
    (this.provider !== 'local' && !this.updated) || validator.isEmail(email)
  );
};

/**
 * A Validation function for password
 */
const validatePassword = function (password) {
  return password && validator.isLength(password, passwordMinLength);
};

/**
 * A Validation function for username
 */
const validateUsername = function (username) {
  return (
    this.provider !== 'local' ||
    authenticationService.validateUsername(username)
  );
};

const setPlainTextField = function (value) {
  return textService.plainText(value, true);
};

const setPlainTextFieldAndLimit = function (limit) {
  return function (value) {
    return setPlainTextField(value).substring(0, limit);
  };
};

/**
 * SubSchema for `User` schema's `member` array
 * This could be defined directly under `UserSchema` as well,
 * but then we'd have extra `_id`'s hanging around.
 */
const UserMemberSchema = new Schema(
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
const UserPushRegistrationSchema = new Schema(
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

/**
 * User Schema
 */
const UserSchema = new Schema({
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
    required: true,
    validate: [validateLocalStrategyProperty, 'Please fill in your last name.'],
    set: setPlainTextField,
  },
  /* This is generated in Schema pre-save hook below */
  displayName: {
    type: String,
  },
  email: {
    type: String,
    trim: true,
    unique: 'Account with this email exists already.',
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
      email => !email || validator.isEmail(email),
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
    unique: 'Username exists already.',
    required: true,
    validate: [
      validateUsername,
      'Please fill in valid username: 3+ characters long, non banned word, characters "_-.", no consecutive dots, does not begin or end with dots, letters a-z and numbers 0-9.',
    ],
    lowercase: true, // Stops users creating case sensitive duplicate usernames with "username" and "USERname", via @link https://github.com/meanjs/mean/issues/147
    trim: true,
  },
  usernameUpdated: {
    type: Date,
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
  // nostr npub
  nostrNpub: {
    type: String,
    trim: true,
    lowercase: true,
    set: setPlainTextField,
  },
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
    enum: ['none', 'gravatar', 'facebook', 'local'],
    default: 'gravatar',
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

/**
 * Hook a pre save method to hash the password
 */
UserSchema.pre('save', function (next) {
  const user = this;
  async function prepare() {
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
      user.displayName = user.firstName + ' ' + user.lastName;
    }
  }

  prepare().then(() => next(), next);
});

/**
 * Create static helper for hashing a plaintext password
 */
UserSchema.statics.hashPassword = passwordHashing.hashPassword;

UserSchema.statics.isValidPassword = validatePassword;

UserSchema.methods.hashPassword = function (password) {
  return this.constructor.hashPassword(password);
};

/**
 * Create instance method for authenticating user
 */
UserSchema.methods.authenticate = async function (password) {
  const oldPassword = this.password;
  const oldSalt = this.salt;
  const verification = await passwordHashing.verifyPassword(
    password,
    oldPassword,
    oldSalt,
  );
  if (!verification.valid) return false;
  if (!verification.needsRehash) return true;

  const newPassword = await passwordHashing.hashPassword(password);
  const filter = {
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

  const result = await this.constructor
    .updateOne(filter, {
      $set: { password: newPassword },
      $unset: { salt: 1 },
    })
    .exec();
  const matchedCount = result.matchedCount ?? result.n;
  if (matchedCount === 1) {
    this.password = newPassword;
    this.salt = undefined;
    return true;
  }

  // Another request may already have upgraded the same password, or a
  // concurrent reset/change may have replaced it. Re-check stored
  // credentials so concurrent upgrades succeed and true password changes fail.
  const fresh = await this.constructor
    .findById(this._id)
    .select('password salt')
    .lean()
    .exec();
  if (!fresh) return false;

  const retry = await passwordHashing.verifyPassword(
    password,
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
  { nostrNpub: 1 },
  {
    unique: true,
    partialFilterExpression: { nostrNpub: { $type: 'string', $gt: '' } },
  },
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
mongoose.model('User', UserSchema);

const defaultExport = {};
export default defaultExport;
export { defaultExport as 'module.exports' };
