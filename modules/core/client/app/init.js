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
  function initConfig(lockerProvider, cfpLoadingBarProvider, $locationProvider, $urlMatcherFactoryProvider, $messageCenterServiceProvider) {

    // Setting HTML5 Location Mode
    $locationProvider.html5Mode({
      enabled: true,
      // We do have <base> tag defined, but requiring it for Karma tests breaks tests...
      // @todo better solution?
      requireBase: false
    }).hashPrefix('!');

    // Make a trailing slash optional for all routes (ui-router)
    // @link https://github.com/angular-ui/ui-router/wiki/Frequently-Asked-Questions#how-to-make-a-trailing-slash-optional-for-all-routes
    $urlMatcherFactoryProvider.strictMode(false);

    // Hide spinner from the loading interceptor
    // @link https://github.com/chieffancypants/angular-loading-bar
    cfpLoadingBarProvider.includeSpinner = false;

    // Configure local storage module
    // @link https://github.com/tymondesigns/angular-locker
    lockerProvider.defaults({
        driver: 'local', // local|session
        namespace: ApplicationConfiguration.applicationModuleName,
        separator: '.',
        eventsEnabled: false,
        extend: {}
    });

    // Default timeout for success, error etc messages
    $messageCenterServiceProvider.setGlobalOptions({timeout: 6000});

  }

  // Then define the init function for starting up the application
  angular.element(document).ready(function() {
    // Fixing facebook bug with redirect
    if (window.location.hash === '#_=_') window.location.hash = '';

    // Then init the app
    angular.bootstrap(document, [ApplicationConfiguration.applicationModuleName]);
  });

})();
