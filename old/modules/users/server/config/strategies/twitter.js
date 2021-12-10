/**
 * Module dependencies.
 */
const _ = require('lodash');
const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const usersAuthentication = require('../../controllers/users.authentication.server.controller');

module.exports = function (config) {
  // Get config parameters for the strategy
  const clientID = _.get(config, 'twitter.clientID');
  const clientSecret = _.get(config, 'twitter.clientSecret');
  const callbackURL = _.get(config, 'twitter.callbackURL');

  // Don't configure the strategy if missing configuration
  if (!clientID || !clientSecret || !callbackURL) {
    return;
  }

  // Use Twitter strategy
  passport.use(
    new TwitterStrategy(
      {
        consumerKey: clientID,
        consumerSecret: clientSecret,
        callbackURL,
        passReqToCallback: true,
      },
      function (req, token, tokenSecret, profile, done) {
        // Set the provider data and include tokens
        const providerData = profile._json || {};
        providerData.token = token;
        providerData.tokenSecret = tokenSecret;

        // Create the user OAuth profile
        const providerUserProfile = {
          displayName: _.get(profile, 'displayName', undefined),
          username: _.get(profile, 'username', undefined),
          provider: 'twitter',
          providerIdentifierField: 'id_str',
          providerData,
        };

        // Save the user OAuth profile
        usersAuthentication.saveOAuthUserProfile(
          req,
          providerUserProfile,
          done,
        );
      },
    ),
  );
};
