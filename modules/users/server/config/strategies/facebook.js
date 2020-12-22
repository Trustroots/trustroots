/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const usersAuthentication = require('../../controllers/users.authentication.server.controller');
const log = require(path.resolve('./config/lib/logger'));

module.exports = function (config) {
  // Get config parameters for the strategy
  const clientID = _.get(config, 'facebook.clientID');
  const clientSecret = _.get(config, 'facebook.clientSecret');
  const callbackURL = _.get(config, 'facebook.callbackURL');

  // Don't configure the strategy if missing configuration
  if (!clientID || !clientSecret || !callbackURL) {
    log(
      'error',
      'Cannot configure Facebook strategy due missing configuration #38h1jv',
      {
        clientIDExists: Boolean(clientID),
        clientSecretExists: Boolean(clientSecret),
        callbackURLExists: Boolean(callbackURL),
      },
    );
    return;
  }

  // Use facebook strategy
  passport.use(
    new FacebookStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        // Available fields:
        // @link https://developers.facebook.com/docs/graph-api/reference/user/
        // Validate fields using Graph explorer (`/me?fields=id,name,...`):
        // @link https://developers.facebook.com/tools/explorer/
        profileFields: [
          'id',
          'email',
          'first_name',
          'last_name',
          'gender',
          'link',
          'picture',
        ],
        // Note FB API version
        // v2.10 is available until November 7, 2019
        //
        // @link https://developers.facebook.com/docs/apps/versions
        // @link https://developers.facebook.com/docs/apps/changelog
        profileURL: 'https://graph.facebook.com/v2.10/me',
        passReqToCallback: true,
        enableProof: false,
      },
      function (req, accessToken, refreshToken, profile, done) {
        // Set the provider data and include tokens
        const providerData = profile._json;
        providerData.accessToken = accessToken;
        providerData.refreshToken = refreshToken;

        // Create the user OAuth profile
        const providerUserProfile = {
          firstName: _.get(profile, 'name.first_name', undefined),
          lastName: _.get(profile, 'name.last_name', undefined),
          displayName: _.get(profile, 'name', undefined),
          email: _.get(profile, 'email', undefined),
          provider: 'facebook',
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
