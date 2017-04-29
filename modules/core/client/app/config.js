'use strict';

// Init the application configuration module for AngularJS application
// eslint-disable-next-line no-unused-vars
var AppConfig = (function () {
  // Init module configuration options
  // eslint-disable-next-line angular/window-service
  var appEnv = window.env || 'production';
  var appModuleName = 'trustroots';
  var appModuleVendorDependencies = [
    'ngResource',
    'ngAnimate',
    'ngTouch',
    'ngSanitize',
    'ngMessageFormat',
    'angulartics',
    'ui.router',
    'ui.bootstrap',
    'ui.bootstrap.dateparser',
    'ui.bootstrap.datepicker',
    'ui.bootstrap.buttons',
    'ui.bootstrap.collapse',
    'ui.bootstrap.dropdown',
    'ui.bootstrap.modal',
    'ui.bootstrap.popover',
    'ui.bootstrap.progressbar',
    'ui.bootstrap.tabs',
    'ui.bootstrap.tooltip',
    'ui.bootstrap.typeahead',
    'angularMoment',
    'nemLogging',
    'ui-leaflet',
    'ngFileUpload',
    'zumba.angular-waypoints',
    'MessageCenterModule',
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
    appModuleVendorDependencies.push('angulartics.google.analytics');
  } else {
    appModuleVendorDependencies.push('angulartics.debug');
  }

  // Add a new vertical module
  var registerModule = function(moduleName, dependencies) {
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
