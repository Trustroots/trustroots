'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    config = require(path.resolve('./config/config')),
    mongoose = require('mongoose'),
    mongoosePaginate = require('mongoose-paginate'),
    uniqueValidation = require('mongoose-beautiful-unique-validation'),
    integerValidator = require('mongoose-integer'),
    URLSlugs = require('mongoose-url-slugs'),
    randomColor = require('randomcolor'),
    speakingurl = require('speakingurl'),
    validator = require('validator'),
    Schema = mongoose.Schema;

/**
 * Return random dark hex color without leading `#`
 */
function randomHex() {
  return randomColor({
    luminosity: 'dark',
    format: 'hex'
  }).substr(1);
}

/**
 * A Validation function for `TagSchema.label`
 * - should contain at least one a-zA-Z character
 * - not in list of illegal labels
 * - not begin or end with "."
 */
var validateLabel = function(label) {
  return (label &&
          label.match(/[a-z]/) && // Should have at least one a-zA-Z (non case-insensitive regex)
          config.illegalStrings.indexOf(label.trim().toLowerCase()) < 0 &&
          label.charAt(0) !== '.' && // Don't start with `.`
          label.slice(-1) !== '.' // Don't end with `.`
         );
};

/**
 * Validation function for `TagSchema.attribution_url`
 * @link https://www.npmjs.com/package/validator#validators
 */
var validateURL = function(url) {
  return !url || validator.isURL(url, {
    protocols: ['http','https'],
    require_tld: true,
    require_protocol: true,
    require_valid_protocol: true,
    allow_underscores: false,
    allow_trailing_dot: false,
    allow_protocol_relative_urls: false
  });
};

/**
 * Tag Schema
 */
var TagSchema = new Schema({
  label: {
    type: String,
    minlength: 2,
    maxlength: 255,
    trim: true,
    required: true,
    unique: 'Tag exists already.',
    validate: [validateLabel, 'Please fill a valid name.']
  },
  labelHistory: {
    type: [String]
  },
  slugHistory: {
    type: [String]
  },
  synonyms: {
    type: [String]
  },
  tribe: {
    type: Boolean,
    default: false,
    required: true
  },
  color: {
    type: String,
    minlength: 6,
    maxlength: 6,
    required: true,
    default: randomHex
  },
  count: {
    type: Number,
    integer: true,
    min: 0,
    default: 0,
    required: true
  },
  created: {
    type: Date,
    default: Date.now,
    required: true
  },
  modified: {
    type: Date
  },
  public: {
    type: Boolean,
    default: true,
    required: true
  },
  image: {
    type: Boolean,
    default: false,
    required: true
  },
  attribution: {
    type: String,
    minlength: 3,
    maxlength: 255
  },
  attribution_url: {
    type: String,
    minlength: 12,
    trim: true,
    validate: [validateURL, 'Please fill a valid URL.']
  }
});

/**
 * Inserts `slug` field to schema and automatically generates unique slug from `label` field.
 * @link https://www.npmjs.com/package/mongoose-url-slugs
 *
 * Uses `speakingurl` package to generate slugs.
 * @link https://npmjs.org/package/speakingurl
 * @link https://github.com/mindblaze/mongoose-url-slugs/issues/17
 */
TagSchema.plugin(URLSlugs('label', {
  field: 'slug',
  generator: function(string) {
    return speakingurl(string, {
      separator: '-', // char that replaces the whitespaces
      maintainCase: false, // maintain case (true, convert all chars to lower case (false)
  	  truncate: 255 // trim to max length ({number}), don't truncate (0)
    });
  }
}));

/**
 * Make sure unique fields yeld verbal errors
 * @link https://www.npmjs.com/package/mongoose-beautiful-unique-validation
 */
TagSchema.plugin(uniqueValidation);

/**
 * Validate Integers
 * @link https://www.npmjs.com/package/mongoose-integer
 */
TagSchema.plugin(integerValidator);

/**
 * Indexing
 */
TagSchema.index({ slug: 1, label: 1 });

/**
 * Pagination (together with `paginate-express`)
 */
TagSchema.plugin(mongoosePaginate);

mongoose.model('Tag', TagSchema);
