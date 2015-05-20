'use strict';

/**
 * Module dependencies.
 */
var crypto = require('crypto'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema;

/**
 * A Validation function for local strategy properties
 */
var validateLocalStrategyProperty = function(property) {
  return ((this.provider !== 'local' && !this.updated) || property.length);
};

/**
 * A Validation function for local strategy password
 */
var validateLocalStrategyPassword = function(password) {
  return (this.provider !== 'local' || (password && password.length >= 8));
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
<<<<<<< HEAD:app/models/user.server.model.js
  var usernameRegex = /^(?=.*[0-9a-z])[0-9a-z.\-_]{3,}$/,
      dotsRegex = /^[^.](?!.*(\.)\1).*[^.]$/,
=======
  var usernameRegex = /^[a-z0-9.\-_]{3,32}$/,
      dotsRegex = /^([^.]+\.?)$/,
>>>>>>> origin/vertical-modules:modules/users/server/models/user.server.model.js
      illegalUsernames = ['trustroots', 'trust', 'roots', 're', 're:', 'fwd', 'fwd:', 'reply', 'admin', 'administrator', 'user', 'profile', 'password', 'username', 'unknown', 'anonymous', 'home', 'signup', 'signin', 'edit', 'settings', 'password', 'username', 'user', ' demo', 'test'];
  return (this.provider !== 'local' || ( username &&
                                         usernameRegex.test(username) &&
                                       illegalUsernames.indexOf(username) < 0) &&
                                       dotsRegex.test(username)
                                     );
};

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
    unique: true,
    lowercase: true,
    default: '',
    validate: [validateLocalStrategyProperty, 'Please enter your email'],
    match: [/.+\@.+\..+/, 'Please enter a valid email address']
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
    enum: ['','male','female','other'],
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
    unique: true,
    required: 'Please fill in a username',
    validate: [validateUsername, 'Please fill in valid username: 3+ characters long, non banned word, characters "_-.", no consecutive dots, does not begin or end with dots, letters a-z and numbers 0-9.'],
    lowercase: true, // Stops users creating case sensitive duplicate usernames with "username" and "USERname", via @link https://github.com/meanjs/mean/issues/147
    trim: true
  },
  // Stores unaltered original username
  displayUsername:{
    type: String,
    default: '',
    trim: true
  },
  password: {
    type: String,
    default: '',
    validate: [validateLocalStrategyPassword, 'Password should be more than 8 characters long.']
  },
  emailHash: {
    type: String
  },
  salt: {
    type: String
  },
  /* All this provider stuff relates to oauth logins, will always be local for
     Trustroots, comes from boilerplate */
  provider: {
    type: String,
    required: 'Provider is required'
  },
  providerData: {},
  additionalProvidersData: {},
  roles: {
    type: [{
      type: String,
      enum: ['user', 'admin']
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
    enum: ['none','gravatar','facebook','local'],
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
  /* For reset password */
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  }
});

/**
 * Hook a pre save method to hash the password
 */
UserSchema.pre('save', function(next) {
  if (this.password && this.password.length > 6) {
    this.salt = crypto.randomBytes(16).toString('base64');
    this.password = this.hashPassword(this.password);
  }

  // Pre-cached email hash to use with Gravatar
  if(this.email && this.email !== '') {
    this.emailHash = crypto.createHash('md5').update( this.email.trim().toLowerCase() ).digest('hex');
  }

  next();
});

/**
 * Create instance method for hashing a password
 */
UserSchema.methods.hashPassword = function(password) {
  if (this.salt && password) {
    return crypto.pbkdf2Sync(password, new Buffer(this.salt, 'base64'), 10000, 64).toString('base64');
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

mongoose.model('User', UserSchema);
