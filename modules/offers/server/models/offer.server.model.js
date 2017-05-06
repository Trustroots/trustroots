'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

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
  templates: {
    type: Object,
    default: { 'directions': '' },
    trim: true
  },
  // Actual location user has marked
  location: {
    type: [Number]
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
