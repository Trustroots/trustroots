'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    passport = require('passport'),
    FacebookStrategy = require('passport-facebook').Strategy,
    users = require('../../controllers/users.server.controller');

module.exports = function(config) {
  // Use facebook strategy
  var clientID = _.get(config, 'facebook.clientID');
  var clientSecret = _.get(config, 'facebook.clientSecret');
  var callbackURL = _.get(config, 'facebook.callbackURL');

  // Don't configure Facebook strategy if missing configuration
  if (!clientID || !clientSecret || !callbackURL) {
    return;
  }

  passport.use(new FacebookStrategy({
    clientID: clientID,
    clientSecret: clientSecret,
    callbackURL: callbackURL,
    profileFields: ['id', 'name', 'displayName', 'emails', 'photos'],
    passReqToCallback: true,
    enableProof: false
  },
  function(req, accessToken, refreshToken, profile, done) {
    // Set the provider data and include tokens
    var providerData = profile._json;
    providerData.accessToken = accessToken;
    providerData.refreshToken = refreshToken;

    // Create the user OAuth profile
    var providerUserProfile = {
      firstName: profile.name.givenName,
      lastName: profile.name.familyName,
      displayName: profile.displayName,
      email: profile.emails && profile.emails.length ? profile.emails[0].value : '',
      provider: 'facebook',
      providerIdentifierField: 'id',
      providerData: providerData
    };

    // Save the user OAuth profile
    users.saveOAuthUserProfile(req, providerUserProfile, done);
  }));
};
