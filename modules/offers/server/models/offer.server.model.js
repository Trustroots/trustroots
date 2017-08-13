'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema;

/**
 * A Validation function for local strategy properties
 *
 * @param {Array} property - Expects location coordinates in an array
 * @returns {Boolean} true on success, false on failure.
 */
var validateLocation = function(property) {
  return (
    // Has to be an Array with 2 Numbers
    _.isArray(property) &&
    property.length === 2 &&

    // Latitude
    _.isFinite(property[0]) &&
    _.inRange(property[0], -90, 90) &&

    // Longitude
    _.isFinite(property[1]) &&
    _.inRange(property[1], -180, 180)
  );
};

/**
 * Offers Schema
 */
var OfferSchema = new Schema({
  status: {
    type: String,
    enum: ['yes', 'maybe', 'no'],
    default: 'no'
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  // This is shown on profiles when users say they are not hosting
  noOfferDescription: {
    type: String,
    default: '',
    trim: true
  },
  maxGuests: {
    type: Number,
    min: 0,
    max: 99,
    default: 1
  },
  // Actual location user has marked
  location: {
    type: [Number],
    required: true,
    validate: [validateLocation, 'Invalid coordinates for location.']
  },
  // This is sent publicly to frontend;
  // some 50-200m fuzzy presentation of actual location
  locationFuzzy: {
    type: [Number]
  },
  updated: {
    type: Date,
    default: Date.now
  },
  user: {
    type: Schema.ObjectId,
    ref: 'User'
  },
  reactivateReminderSent: {
    type: Date
  }
});

// Geospatial index (lat,lon)
OfferSchema.index({ location: '2d' });
OfferSchema.index({ locationFuzzy: '2d' });

mongoose.model('Offer', OfferSchema);
