/**
 * Module dependencies.
 */
var _ = require('lodash'),
    passport = require('passport'),
    TwitterStrategy = require('passport-twitter').Strategy,
    usersAuthentication = require('../../controllers/users.authentication.server.controller');

module.exports = function (config) {

  // Get config parameters for the strategy
  var clientID = _.get(config, 'twitter.clientID'),
      clientSecret = _.get(config, 'twitter.clientSecret'),
      callbackURL = _.get(config, 'twitter.callbackURL');

  // Don't configure the strategy if missing configuration
  if (!clientID || !clientSecret || !callbackURL) {
    return;
  }

  // Use Twitter strategy
  passport.use(new TwitterStrategy({
    consumerKey: clientID,
    consumerSecret: clientSecret,
    callbackURL: callbackURL,
    passReqToCallback: true
  },
  function (req, token, tokenSecret, profile, done) {
    // Set the provider data and include tokens
    var providerData = profile._json || {};
    providerData.token = token;
    providerData.tokenSecret = tokenSecret;

    // Create the user OAuth profile
    var providerUserProfile = {
      displayName: _.get(profile, 'displayName', undefined),
      username: _.get(profile, 'username', undefined),
      provider: 'twitter',
      providerIdentifierField: 'id_str',
      providerData: providerData
    };

    // Save the user OAuth profile
    usersAuthentication.saveOAuthUserProfile(req, providerUserProfile, done);
  }));
};
