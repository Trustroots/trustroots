'use strict';

// Init the application configuration module for AngularJS application
// eslint-disable-next-line no-unused-vars
var AppConfig = (function () {
  // Init module configuration options
  // When testing, `window.env` is undefined, thus default to 'test'
  // eslint-disable-next-line angular/window-service
  var appEnv = process.env.NODE_ENV || 'test';

  var appModuleName = 'trustroots';
  var appModuleVendorDependencies = [
    'ngAria',
    'ngResource',
    'ngAnimate',
    'ngTouch',
    'ngSanitize',
    'ngMessageFormat',
    'angulartics',
    'ui.router',
    'ui.bootstrap.dateparser',
    'ui.bootstrap.buttons',
    'ui.bootstrap.collapse',
    'ui.bootstrap.dropdown',
    'ui.bootstrap.modal',
    'ui.bootstrap.popover',
    'ui.bootstrap.progressbar',
    'ui.bootstrap.tabs',
    'ui.bootstrap.tooltip',
    'ui.bootstrap.typeahead',
    'ui.bootstrap.datepicker',
    'angularMoment',
    'nemLogging',
    'ui-leaflet',
    'ngFileUpload',
    'zumba.angular-waypoints',
    'localytics.directives',
    'angular-loading-bar',
    'trTrustpass',
    'angular-mailcheck',
    'angular-locker',
    'angular-confirm',
    'angularGrid'
  ];

  /**
   * Load different service dependency for Angulartics depending on environment
   * @link https://github.com/angulartics/angulartics
   */
  if (appEnv === 'production') {
    // @link https://github.com/angulartics/angulartics-google-analytics
    appModuleVendorDependencies.push('angulartics.google.analytics');
  } else if (appEnv === 'development') {
    // @link https://github.com/angulartics/angulartics/blob/master/src/angulartics-debug.js
    appModuleVendorDependencies.push('angulartics.debug');
  } else {
    // For "test" environment
    // See `testutils/angulartics-null.testutil.js`
    appModuleVendorDependencies.push('angulartics.null');
  }

  // Add a new vertical module
  var registerModule = function (moduleName, dependencies) {
    // Create angular module
    angular.module(moduleName, dependencies || []);

    // Add the module to the AngularJS configuration file
    angular.module(appModuleName).requires.push(moduleName);
  };

  return {
    appEnv: appEnv,
    appModuleName: appModuleName,
    appModuleVendorDependencies: appModuleVendorDependencies,
    registerModule: registerModule
  };
}());

module.exports = AppConfig;
