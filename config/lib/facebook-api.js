'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    fbgraph = require('fbgraph'),
    path = require('path'),
    config = require(path.resolve('./config/config'));

// Config vars
// You can modify these from your `config/local.js`
var fbClientID = _.get(config, 'facebook.clientID'),
    fbClientSecret = _.get(config, 'facebook.clientSecret'),
    fbClientAccessToken = _.get(config, 'facebook.clientAccessToken');

/**
 * Configure FB API version
 * v2.10 is available until November 7, 2019
 *
 * @link https://developers.facebook.com/docs/apps/versions
 * @link https://developers.facebook.com/docs/apps/changelog
 */
fbgraph.setVersion('2.10');

/**
 * Graph Authentication
 */
if (fbClientID && fbClientSecret) {
  /**
   * Most `get` calls, and pretty much all `post`
   * calls will require an `access_token`
   *
   * Here is another method to make calls to the Graph API that doesn't require
   * using a generated app access token. You can just pass your app id and app
   * secret as the `access_token` parameter when you make a call:
   * `?access_token=app_id|app_secret`
   *
   * @link https://github.com/criso/fbgraph#static-access-token-used-on-all-calls
   * @link https://developers.facebook.com/docs/facebook-login/access-tokens#apptokens
   */
  fbgraph.setAccessToken(fbClientAccessToken || fbClientID + '|' + fbClientSecret);

  /**
   * Facebook recommends adding the `appsecret_proof` parameter to all API calls
   * to verify that the access tokens are coming from a valid app. You can make
   * this happen automatically by calling `graph.setAppSecret(app_secret)`,
   * which will be used on all calls to generate the `appsecret_proof` hash that
   * is sent to Facebook. Make sure you also set the access token for the user
   * via `graph.setAccessToken`.
   *
   * @link https://developers.facebook.com/docs/reference/api/securing-graph-api/
   * @link https://github.com/criso/fbgraph#securing-api-calls
   */
  fbgraph.setAppSecret(fbClientSecret);
}

module.exports = fbgraph;
