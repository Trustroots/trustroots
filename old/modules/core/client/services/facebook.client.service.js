/* global FB */
angular.module('core').factory('Facebook', FacebookFactory);

/* @ngInject */
function FacebookFactory(
  $log,
  $window,
  $document,
  $http,
  $rootScope,
  Authentication,
) {
  const service = {
    init,
  };

  return service;

  /**
   * Load Facebook javascript SDK
   * Will invoke `fbAsyncInit` when done.
   */
  function init() {
    // Stop loading if the app doesn't have Facebook app ID defined
    if (
      !angular.isString($window.facebookAppId) ||
      $window.facebookAppId === ''
    ) {
      $log.info('No Facebook app ID; skipping `FB.init()`');
      return;
    }

    // Stop loading when:
    // - user isn't authenticated
    // - authenticated user isn't connected to FB
    if (
      !Authentication.user ||
      !Authentication.user.additionalProvidersData ||
      !Authentication.user.additionalProvidersData.facebook
    ) {
      return;
    }

    // Run this function after SDK loads
    $window.fbAsyncInit = fbAsyncInit;

    // Initialize the `<script>`
    (function (d) {
      const id = 'facebook-jssdk';
      const fjs = d.getElementsByTagName('script')[0];

      // Don't add `<script>` tag twice
      if (d.getElementById(id)) {
        return;
      }

      const js = d.createElement('script');
      js.id = id;
      js.async = true;
      js.src = '//connect.facebook.net/en_US/sdk.js';
      fjs.parentNode.insertBefore(js, fjs);
    })($document[0]);
  }

  /**
   * Executed when the SDK is loaded
   * Initialize FB API and get user's authentication status (from FB)
   */
  function fbAsyncInit() {
    FB.init({
      // The app id of the web app;
      // To register a new app visit Facebook App Dashboard
      // https://developers.facebook.com/apps/
      appId: $window.facebookAppId,

      // Check the authentication status of user at the start up of the app?
      // Above event listener `auth.statusChange` requires this to be `true`
      status: true,

      // Enable cookies to allow the server to access?
      // the session
      cookie: true,

      // Parse XFBML?
      xfbml: false,

      // FB API version
      // https://developers.facebook.com/docs/apps/changelog/
      // https://developers.facebook.com/docs/apps/versions#howlong
      version: 'v2.8',
    });

    // Get notified about user's authentication status to FB
    // https://developers.facebook.com/docs/reference/javascript/FB.Event.subscribe/v2.8
    // https://developers.facebook.com/docs/reference/javascript/FB.getLoginStatus/#status
    FB.Event.subscribe('auth.statusChange', statusChangeCallback);

    // Tell anything relying on `FB` that it's now available
    $rootScope.$broadcast('facebookReady');
  }

  /**
   * Handle FB login status
   */
  function statusChangeCallback(response) {
    // `response.status` could be:
    // - `connected`: logged in
    // - `not_authorized`: logged in, but not authorized our app
    // - `unknown`: logged out
    if (response && response.status === 'connected') {
      storeAuthResponse(response.authResponse);
    }
  }

  /**
   * Store new oAuth token to server
   * authResponse:
   * ```
   * {
   *   accessToken: String
   *   expiresIn: Int
   *   signedRequest: String
   *   userID: String
   * }
   * ```
   */
  function storeAuthResponse(authResponse) {
    if (!angular.isObject(authResponse)) {
      return;
    }

    $http.put('/api/auth/facebook', authResponse, {
      // Tells Angular-Loading-Bar to ignore this http request
      // @link https://github.com/chieffancypants/angular-loading-bar#ignoring-particular-xhr-requests
      ignoreLoadingBar: true,
    });
  }
}
