/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const textService = require(path.resolve(
  './modules/core/server/services/text.server.service',
));
const languages = require(path.resolve('./config/languages/languages.json'));
const authenticationService = require(path.resolve(
  './modules/users/server/services/authentication.server.service',
));
const crypto = require('crypto');
const mongoose = require('mongoose');
const uniqueValidation = require('mongoose-beautiful-unique-validation');
const validator = require('validator');
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
 * SubSchema for `User` schema's `pushRegistration` array
 */
const UserPushRegistrationSchema = new Schema(
  {
    platform: {
      type: String,
      // android, ios, web → Firebase; expo → Exponent
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
    match: [/.+@.+\..+/, 'Please enter a valid email address.'],
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
  if (
    this.password &&
    this.isModified('password') &&
    this.password.length >= passwordMinLength
  ) {
    this.salt = crypto.randomBytes(16).toString('base64');
    this.password = this.hashPassword(this.password);
  }

  // Pre-cached email hash to use with Gravatar
  if (this.email && this.isModified('email') && this.email !== '') {
    this.emailHash = crypto
      .createHash('md5')
      .update(this.email.trim().toLowerCase())
      .digest('hex');
  }

  // Generate `displayName`
  if (this.isModified('firstName') || this.isModified('lastName')) {
    this.displayName = this.firstName + ' ' + this.lastName;
  }

  next();
});

/**
 * Create instance method for hashing a password
 */
UserSchema.methods.hashPassword = function (password) {
  if (this.salt && password) {
    return crypto
      .pbkdf2Sync(password, Buffer.from(this.salt, 'base64'), 10000, 64, 'SHA1')
      .toString('base64');
  } else {
    return password;
  }
};

/**
 * Create instance method for authenticating user
 */
UserSchema.methods.authenticate = function (password) {
  return this.password === this.hashPassword(password);
};

/**
 * Make sure unique fields yeld verbal errors
 * @link https://www.npmjs.com/package/mongoose-beautiful-unique-validation
 */
UserSchema.plugin(uniqueValidation);

UserSchema.index({ username: 'text', firstName: 'text', lastName: 'text' });

mongoose.model('User', UserSchema);
