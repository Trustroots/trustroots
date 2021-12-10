/**
 * @ngdoc factory
 * @name core.factory:trNativeAppBridge
 * @description
 * Service for communicating with Native Trustroots mobile app
 */
angular.module('core').factory('trNativeAppBridge', trNativeAppBridgeFactory);

/* @ngInject */
function trNativeAppBridgeFactory(
  $q,
  $rootScope,
  $log,
  $window,
  $timeout,
  $location,
) {
  const service = {
    activate,
    getAppInfo,
    isNativeMobileApp,
    signalUnAuthenticated,
    signalAuthenticated,
  };

  return service;

  /**
   * Tells if the site is wrapped inside native mobile app
   *
   * @returns {Boolea}
   */
  function isNativeMobileApp() {
    return !!$window.isNativeMobileApp;
  }

  /**
   * Activate event listener listening for mobile app wrapping the site in
   * WebView signaling us it's ready.
   *
   * @returns {Promise}
   */
  function activate() {
    return $q(function (resolve) {
      logToNativeApp('trNativeAppBridgeFactory activate');
      // eslint-disable-next-line angular/document-service
      document.addEventListener('message', function (event) {
        // event = event.originalEvent || event;
        if (event && event.data === 'trMobileAppInit' && !isNativeMobileApp()) {
          // document.removeEventListener('message');

          bootstrapBridge();

          resolve($window.trMobileApp || { res: 'No data' });
        }
      });
    });
  }

  /**
   * When mobile app wrapping the site in WebView signals us it's ready,
   * attempt to bootstrap app bridge.
   */
  function bootstrapBridge() {
    logToNativeApp('Bootstrap native app bridge initialised');

    // Not in native mobile, stop here
    if (!$window.trMobileApp || !angular.isObject($window.trMobileApp)) {
      logToNativeApp('Bootstrap native app bridge: not a mobile app');
      return;
    }

    // Signal Native app it can stop polling us with `trMobileAppInit` message
    postMessageToApp('trNativeAppBridgeInitialized');

    // Look in the DOM for new urls after each state change
    $rootScope.$on('$stateChangeSuccess', renderOutgoingUrls);

    logToNativeApp('Bootstrap native app bridge done');
  }

  /**
   * Hooks onto all outgoing urls and instead of letting them open in current
   * browser instance (i.e. React Native WebView), sends a custom event to
   * the app, which then in turn handles opening the URL in the phone.
   */
  function renderOutgoingUrls() {
    logToNativeApp('Render outbound urls');

    const elementPattern = [
      'a[href^="http://"]',
      ',', // And
      'a[href^="https://"]',
      ',', // And
      'a[href^="mailto://"]',
      ',', // And
      'a[href^="tel://"]',
      ',', // And
      'a[href^="tel://"]',
      // Not:
      ':not(.tr-app-urlified)',
      ':not(a[href^="' +
        $location.protocol() +
        '://' +
        $location.host() +
        '"])',
      ':not(a[ui-sref])',
    ].join('');

    // $timetout makes sure we have DOM rendered by Angular
    $timeout(function () {
      angular.element(elementPattern).each(function () {
        angular
          .element(this)
          .addClass('tr-app-urlified')
          .click(function (e) {
            const url = angular.element(this).attr('href');
            if (url) {
              e.preventDefault();
              postMessageToApp('openUrl', {
                url,
              });
            }
          });
      });
    });
  }

  /**
   * Read device & app info, should be something like:
   * ```
   * {
   *   "version": "0.2.0",
   *   "expoVersion": "1.20.0",
   *   "deviceName": "E39",
   *   "deviceYearClass": 2012,
   *   "os": "android"
   * }
   * ```
   *
   * @return {Object}
   */
  function getAppInfo() {
    return $window.trMobileApp || {};
  }

  /**
   * Send "unAuthenticated" signal to mobile app
   */
  function signalUnAuthenticated() {
    if (!isNativeMobileApp()) {
      return;
    }
    postMessageToApp('unAuthenticated');
  }

  /**
   * Send "authenticated" signal to mobile app
   */
  function signalAuthenticated() {
    if (!isNativeMobileApp()) {
      return;
    }
    postMessageToApp('authenticated');
  }

  /**
   * Send log info signal to native app so that we know there what underlaying app is doing
   */
  function logToNativeApp(str) {
    $log.log(str);
    postMessageToApp('log', { log: '[WebView]: ' + str });
  }

  /**
   * Uses `window.postMessage()` to signal a messages to the native app
   *
   * At native app this page is wrapped in React Native WebView.
   *
   * Value in postMessage has to be string.
   */
  function postMessageToApp(action, data) {
    if (
      !isNativeMobileApp() ||
      !action ||
      !angular.isString(action) ||
      !angular.isFunction($window.postMessage)
    ) {
      return;
    }

    data = data && angular.isObject(data) ? data : {};

    const message = angular.extend(
      {
        action,
      },
      data,
    );

    // Note that `angular.toJson()` won't handle Date objects nicely on Safari
    // https://docs.angularjs.org/api/ng/function/angular.toJson
    $window.postMessage(angular.toJson(message));
  }
}
