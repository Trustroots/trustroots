angular.module('core').factory('SettingsService', SettingsService);

/* @ngInject */
function SettingsService($window) {
  let settings = {};
  const service = {
    get,
    settings,
  };
  return service;

  function get() {
    // Settings passed from the backend
    settings = $window.settings;

    // Gimme settings
    return settings;
  }
}

// TODO: Clean this out (deprecated)

angular.module('core').factory('SettingsFactory', SettingsFactory);

/* @ngInject */
function SettingsFactory($window) {
  let settings = {};
  const service = {
    get,
    settings,
  };
  return service;

  function get() {
    // Settings passed from the backend
    settings = $window.settings;

    // Extend with defaults
    angular.extend(settings, {
      // Default timeout for 'message-center' success/alert messages
      flashTimeout: 6000,
    });

    // Gimme settings
    return settings;
  }
}
