/**
 * Module dependencies.
 */
const path = require('path');
const config = require(path.resolve('./config/config'));
const mongoose = require('mongoose');
const moment = require('moment');
const mongoosePaginate = require('mongoose-paginate');
const uniqueValidation = require('mongoose-beautiful-unique-validation');
const integerValidator = require('mongoose-integer');
const urlslugs = require('mongoose-url-slugs');
const randomColor = require('randomcolor');
const speakingurl = require('speakingurl');
const validator = require('validator');
const Schema = mongoose.Schema;

/**
 * Return random dark hex color without leading `#`
 */
function randomHex() {
  return randomColor({
    luminosity: 'dark',
    format: 'hex',
  }).substr(1);
}

/**
 * A Validation function for `TribeSchema.label`
 * - should contain at least one a-zA-Z character
 * - not in list of illegal labels
 * - not begin or end with "."
 */
const validateLabel = function (label) {
  return (
    label &&
    label.match(/[a-zA-Z]/) && // Should have at least one a-zA-Z (non case-insensitive regex)
    config.illegalStrings.indexOf(label.trim().toLowerCase()) < 0 &&
    label.charAt(0) !== '.' && // Don't start with `.`
    label.slice(-1) !== '.' // Don't end with `.`
  );
};

/**
 * Validation function for `TribeSchema.attribution_url`
 * @link https://www.npmjs.com/package/validator#validators
 */
const validateURL = function (url) {
  return (
    !url ||
    validator.isURL(url, {
      protocols: ['http', 'https'],
      require_tld: true,
      require_protocol: true,
      require_valid_protocol: true,
      allow_underscores: false,
      allow_trailing_dot: false,
      allow_protocol_relative_urls: false,
    })
  );
};

/**
 * Tribe Schema
 */
const TribeSchema = new Schema({
  label: {
    type: String,
    minlength: 2,
    maxlength: 255,
    trim: true,
    required: true,
    unique: 'Tribe exists already.',
    validate: [validateLabel, 'Please fill a valid name.'],
  },
  labelHistory: {
    type: [String],
  },
  slugHistory: {
    type: [String],
  },
  synonyms: {
    type: [String],
  },
  color: {
    type: String,
    minlength: 6,
    maxlength: 6,
    required: true,
    default: randomHex,
  },
  count: {
    type: Number,
    integer: true,
    min: 0,
    default: 0,
    required: true,
  },
  created: {
    type: Date,
    default: Date.now,
    required: true,
  },
  modified: {
    type: Date,
    default: Date.now,
  },
  public: {
    type: Boolean,
    default: true,
    required: true,
  },
  image: {
    type: Boolean,
    default: false,
    required: true,
  },
  attribution: {
    type: String,
    minlength: 3,
    maxlength: 255,
  },
  attribution_url: {
    type: String,
    minlength: 12,
    trim: true,
    validate: [validateURL, 'Please fill a valid URL.'],
  },
  description: {
    type: String,
    trim: true,
  },
});

/**
 * Ensure virtual fields get pass `doc.toObject()`
 * "If you use toJSON() or toObject() (or use JSON.stringify()
 *   on a mongoose document) mongoose will not include virtuals
 *   by default. Pass { virtuals: true } to either toObject() or toJSON()."
 * @link http://mongoosejs.com/docs/guide.html#virtuals
 */
TribeSchema.set('toJSON', { getters: true });

/**
 * Create a field `new` based on field `created`
 *
 * @link http://mongoosejs.com/docs/guide.html#virtuals
 */
TribeSchema.virtual('new').get(function () {
  // Set comparison date to 30 days ago from now
  const newLimit = moment().subtract(60, 'day');

  // Is `created` defined and after comparison date?
  return (
    typeof this.created !== 'undefined' &&
    moment(this.created).isAfter(newLimit)
  );
});

/**
 * Inserts `slug` field to schema and automatically generates unique slug from `label` field.
 * @link https://www.npmjs.com/package/mongoose-url-slugs
 *
 * Uses `speakingurl` package to generate slugs.
 * @link https://npmjs.org/package/speakingurl
 * @link https://github.com/mindblaze/mongoose-url-slugs/issues/17
 */
TribeSchema.plugin(
  urlslugs('label', {
    field: 'slug',
    generator(string) {
      return speakingurl(string, {
        separator: '-', // char that replaces the whitespaces
        maintainCase: false, // maintain case (true, convert all chars to lower case (false)
        truncate: 255, // trim to max length ({number}), don't truncate (0)
      });
    },
  }),
);

/**
 * Make sure unique fields yeld verbal errors
 * @link https://www.npmjs.com/package/mongoose-beautiful-unique-validation
 */
TribeSchema.plugin(uniqueValidation);

/**
 * Validate Integers
 * @link https://www.npmjs.com/package/mongoose-integer
 */
TribeSchema.plugin(integerValidator);

/**
 * Indexing
 */
TribeSchema.index({ slug: 1, label: 1 });

/**
 * Pagination (together with `paginate-express`)
 */
TribeSchema.plugin(mongoosePaginate);

mongoose.model('Tribe', TribeSchema);
