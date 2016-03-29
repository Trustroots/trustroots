'use strict';

// Init the application configuration module for AngularJS application
var AppConfig = (function() {
  // Init module configuration options
  var appModuleName = 'trustroots';
  var appModuleVendorDependencies = [
                                              'ngResource',
                                              'ngAnimate',
                                              'ngTouch',
                                              'ngSanitize',
                                              'ngMessageFormat',
                                              'ui.router',
                                              'ui.bootstrap.buttons',
                                              'ui.bootstrap.collapse',
                                              'ui.bootstrap.dropdown',
                                              'ui.bootstrap.modal',
                                              'ui.bootstrap.popover',
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
                                              'angular-locker'
                                            ];

  // Add a new vertical module
  var registerModule = function(moduleName, dependencies) {
    // Create angular module
    angular.module(moduleName, dependencies || []);

    // Add the module to the AngularJS configuration file
    angular.module(appModuleName).requires.push(moduleName);
  };

  return {
    appModuleName: appModuleName,
    appModuleVendorDependencies: appModuleVendorDependencies,
    registerModule: registerModule
  };
})();
