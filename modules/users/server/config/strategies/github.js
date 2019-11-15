/**
 * Module dependencies.
 */
var _ = require('lodash'),
    passport = require('passport'),
    GithubStrategy = require('passport-github').Strategy,
    usersAuthentication = require('../../controllers/users.authentication.server.controller');

module.exports = function (config) {

  // Get config parameters for the strategy
  var clientID = _.get(config, 'github.clientID'),
      clientSecret = _.get(config, 'github.clientSecret'),
      callbackURL = _.get(config, 'github.callbackURL');

  // Don't configure the strategy if missing configuration
  if (!clientID || !clientSecret || !callbackURL) {
    return;
  }

  // Use Github strategy
  passport.use(new GithubStrategy({
    clientID: clientID,
    clientSecret: clientSecret,
    callbackURL: callbackURL,
    passReqToCallback: true
  },
  function (req, accessToken, refreshToken, profile, done) {
    // Set the provider data and include tokens
    var providerData = profile._json || {};
    providerData.accessToken = accessToken;
    providerData.refreshToken = refreshToken;

    // Create the user OAuth profile
    var providerUserProfile = {
      displayName: profile.displayName || profile.username || undefined,
      email: _.get(profile, 'emails[0].value', undefined),
      username: profile.username || undefined,
      provider: 'github',
      providerIdentifierField: 'id',
      providerData: providerData
    };

    // Save the user OAuth profile
    usersAuthentication.saveOAuthUserProfile(req, providerUserProfile, done);
  }));
};
