/**
 * Module dependencies.
 */
const _ = require('lodash');
const passport = require('passport');
const GithubStrategy = require('passport-github').Strategy;
const usersAuthentication = require('../../controllers/users.authentication.server.controller');

module.exports = function (config) {
  // Get config parameters for the strategy
  const clientID = _.get(config, 'github.clientID');
  const clientSecret = _.get(config, 'github.clientSecret');
  const callbackURL = _.get(config, 'github.callbackURL');

  // Don't configure the strategy if missing configuration
  if (!clientID || !clientSecret || !callbackURL) {
    return;
  }

  // Use Github strategy
  passport.use(
    new GithubStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        passReqToCallback: true,
      },
      function (req, accessToken, refreshToken, profile, done) {
        // Set the provider data and include tokens
        const providerData = profile._json || {};
        providerData.accessToken = accessToken;
        providerData.refreshToken = refreshToken;

        // Create the user OAuth profile
        const providerUserProfile = {
          displayName: profile.displayName || profile.username || undefined,
          email: _.get(profile, 'emails[0].value', undefined),
          username: profile.username || undefined,
          provider: 'github',
          providerIdentifierField: 'id',
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
