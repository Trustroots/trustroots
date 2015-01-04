'use strict';

// Init the application configuration module for AngularJS application
var ApplicationConfiguration = (function() {

  // Init module configuration options
  var applicationModuleName = 'trust-roots';
  var applicationModuleVendorDependencies = [
                                              'ngResource',
                                              'ngAnimate',
                                              'ngTouch',
                                              'ngSanitize',
                                              'ui.router',
                                              'ui.bootstrap',
                                              'ui.utils',
                                              'ui.select',
                                              'btford.socket-io',
                                              'angularMoment',
                                              'angular-medium-editor',
                                              'perfect_scrollbar',
                                              'leaflet-directive',
                                              'ngGeolocation',
                                              'wu.masonry',
                                              'zumba.angular-waypoints',
                                              'angularFileUpload'
                                            ];

  // Add a new vertical module
  var registerModule = function(moduleName, dependencies) {
    // Create angular module
    angular.module(moduleName, dependencies || []);

    // Add the module to the AngularJS configuration file
    angular.module(applicationModuleName).requires.push(moduleName);
  };

  return {
    applicationModuleName: applicationModuleName,
    applicationModuleVendorDependencies: applicationModuleVendorDependencies,
    registerModule: registerModule
  };
})();
