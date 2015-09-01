(function() {
 'use strict';

  // Start by defining the main module and adding the module dependencies
  angular
    .module(ApplicationConfiguration.applicationModuleName,
            ApplicationConfiguration.applicationModuleVendorDependencies);

  // App configs
  angular
    .module(ApplicationConfiguration.applicationModuleName)
    .config(initConfig);

  /* @ngInject */
  function initConfig(localStorageServiceProvider, $locationProvider) {

    // Setting HTML5 Location Mode
    $locationProvider.html5Mode({
      enabled: true,
      // We do have <base> tag defined, but requiring it for Karma tests breaks tests...
      // @todo better solution?
      requireBase: false
    }).hashPrefix('!');

    // Configure local storage module
    // Not using localStorage here, but sessionStorage instead. It'll get wiped out when closing the browser.
    // @link https://github.com/grevory/angular-local-storage#configuration
    localStorageServiceProvider
      .setPrefix(ApplicationConfiguration.applicationModuleName)
      .setStorageType('sessionStorage');

  }

  // Then define the init function for starting up the application
  angular.element(document).ready(function() {
    // Fixing facebook bug with redirect
    if (window.location.hash === '#_=_') window.location.hash = '#!';

    // Then init the app
    angular.bootstrap(document, [ApplicationConfiguration.applicationModuleName]);
  });

})();
