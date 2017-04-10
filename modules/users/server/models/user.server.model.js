'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    config = require(path.resolve('./config/config')),
    crypto = require('crypto'),
    mongoose = require('mongoose'),
    uniqueValidation = require('mongoose-beautiful-unique-validation'),
    validator = require('validator'),
    Schema = mongoose.Schema;

var passwordMinLength = 8;

/**
 * A Validation function for local strategy properties
 */
var validateLocalStrategyProperty = function(property) {
  return ((this.provider !== 'local' && !this.updated) || property.length);
};

/**
 * A Validation function for local strategy email
 */
var validateLocalStrategyEmail = function(email) {
  return ((this.provider !== 'local' && !this.updated) || validator.isEmail(email));
};

/**
 * A Validation function for password
 */
var validatePassword = function(password) {
  return password && validator.isLength(password, passwordMinLength);
};

/**
 * A Validation function for username
 * - at least 3 characters
 * - only a-z0-9_-.
 * - contain at least one alphanumeric character
 * - not in list of illegal usernames
 * - no consecutive dots: "." ok, ".." nope
 * - not begin or end with "."
 */

var validateUsername = function(username) {
  var usernameRegex = /^(?=.*[0-9a-z])[0-9a-z.\-_]{3,34}$/,
      dotsRegex = /^[^.](?!.*(\.)\1).*[^.]$/;
  return (
    this.provider !== 'local' ||
    (username && usernameRegex.test(username) && config.illegalStrings.indexOf(username) < 0) &&
    dotsRegex.test(username)
  );
};

/**
 * SubSchema for `User` schema's `member` array
 * This could be defined directly under `UserSchema` as well,
 * but then we'd have extra `_id`'s hanging around.
 */
var UserMemberSchema = new Schema({
  tag: {
    type: Schema.Types.ObjectId,
    ref: 'Tag',
    required: true
  },
  relation: {
    type: String,
    enum: ['is', 'likes'],
    default: 'is',
    required: true
  },
  since: {
    type: Date,
    default: Date.now,
    required: true
  }
}, { _id: false });

/**
 * SubSchema for `User` schema's `pushRegistration` array
 */
var UserPushRegistrationSchema = new Schema({
  platform: {
    type: String,
    enum: ['android', 'ios', 'web'],
    required: true
  },
  token: {
    type: String,
    required: true
  },
  created: {
    type: Date,
    default: Date.now,
    required: true
  }
}, { _id: false });


/**
 * User Schema
 */
var UserSchema = new Schema({
  firstName: {
    type: String,
    trim: true,
    default: '',
    validate: [validateLocalStrategyProperty, 'Please fill in your first name']
  },
  lastName: {
    type: String,
    trim: true,
    default: '',
    validate: [validateLocalStrategyProperty, 'Please fill in your last name']
  },
  /* This is (currently) generated in users.profile.server.controller.js */
  displayName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    unique: 'Email exists already.',
    lowercase: true,
    required: true,
    validate: [validateLocalStrategyEmail, 'Please fill a valid email address']
  },
  /* New email is stored here until it is confirmed */
  emailTemporary: {
    type: String,
    trim: true,
    lowercase: true,
    default: '',
    match: [/.+\@.+\..+/, 'Please enter a valid email address']
  },
  tagline: {
    type: String,
    default: '',
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  birthdate: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['', 'male', 'female', 'other'],
    default: ''
  },
  languages: {
    type: [{
      type: String
    }],
    default: []
  },
  locationLiving: {
    type: String
  },
  locationFrom: {
    type: String
  },
  // Lowercase enforced username
  username: {
    type: String,
    unique: 'Username exists already.',
    required: true,
    validate: [validateUsername, 'Please fill in valid username: 3+ characters long, non banned word, characters "_-.", no consecutive dots, does not begin or end with dots, letters a-z and numbers 0-9.'],
    lowercase: true, // Stops users creating case sensitive duplicate usernames with "username" and "USERname", via @link https://github.com/meanjs/mean/issues/147
    trim: true
  },
  // Stores unaltered original username
  displayUsername: {
    type: String,
    trim: true
  },
  // Bewelcome.org username
  extSitesBW: {
    type: String,
    trim: true
  },
  // Couchsurfing.com username
  extSitesCS: {
    type: String,
    trim: true
  },
  // Warmshowers.org username
  extSitesWS: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    default: '',
    validate: [validatePassword, 'Password should be more than ' + passwordMinLength + ' characters long.']
  },
  emailHash: {
    type: String
  },
  salt: {
    type: String
  },
  /* All this provider stuff relates to oauth logins, will always be local for
     Trustroots, comes from boilerplate. Will be removed one day. */
  provider: {
    type: String,
    required: true
  },
  /* Facebook, Twitter etc data is stored here. */
  providerData: {},
  additionalProvidersData: {},
  roles: {
    type: [{
      type: String,
      enum: ['user', 'admin', 'suspended']
    }],
    default: ['user']
  },
  /* The last time the user was logged in (uncertain if its live right now 5 Apr 2015) */
  seen: {
    type: Date
  },
  updated: {
    type: Date
  },
  created: {
    type: Date,
    default: Date.now
  },
  avatarSource: {
    type: String,
    enum: ['none', 'gravatar', 'facebook', 'local'],
    default: 'gravatar'
  },
  avatarUploaded: {
    type: Boolean,
    default: false
  },
  newsletter: {
    type: Boolean,
    default: false
  },
  /* For email confirmations */
  emailToken: {
    type: String
  },
  /* New users are public=false until they validate their email. If public=false,
     users can't email other users, can't be seen by other users. They are
     effectively black holed... */
  public: {
    type: Boolean,
    default: false
  },
  /* Count and latest date of emails sent to remind about un-finished signup
     Will be removed once user sets `public:true` */
  publicReminderCount: {
    type: Number
  },
  publicReminderSent: {
    type: Date
  },
  /* For reset password */
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  },
  /* Tags & Tribes user is member of */
  member: {
    type: [UserMemberSchema]
  },
  pushRegistration: {
    type: [UserPushRegistrationSchema]
  }
});

/**
 * Hook a pre save method to hash the password
 */
UserSchema.pre('save', function(next) {
  if (this.password && this.isModified('password') && this.password.length >= passwordMinLength) {
    this.salt = crypto.randomBytes(16).toString('base64');
    this.password = this.hashPassword(this.password);
  }

  // Pre-cached email hash to use with Gravatar
  if (this.email && this.isModified('email') && this.email !== '') {
    this.emailHash = crypto.createHash('md5').update(this.email.trim().toLowerCase()).digest('hex');
  }

  next();
});

/**
 * Create instance method for hashing a password
 */
UserSchema.methods.hashPassword = function(password) {
  if (this.salt && password) {
    return crypto.pbkdf2Sync(password, new Buffer(this.salt, 'base64'), 10000, 64, 'SHA1').toString('base64');
  } else {
    return password;
  }
};

/**
 * Create instance method for authenticating user
 */
UserSchema.methods.authenticate = function(password) {
  return this.password === this.hashPassword(password);
};

/**
 * Make sure unique fields yeld verbal errors
 * @link https://www.npmjs.com/package/mongoose-beautiful-unique-validation
 */
UserSchema.plugin(uniqueValidation);

mongoose.model('User', UserSchema);
