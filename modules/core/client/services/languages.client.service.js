angular.module('core').factory('Languages', LanguagesFactory);

/* @ngInject */
function LanguagesFactory($resource, $q) {
  const Languages = $resource(
    '/api/languages',
    {},
    {
      get: {
        method: 'GET',
      },
    },
  );

  const service = {
    get,
  };

  return service;

  /**
   * Format languages from object format into array; some Angular directives require this in UI
   */
  function objectToArray(languages) {
    const langsArr = [];

    angular.forEach(
      languages,
      function (value, key) {
        this.push({ key, name: value });
      },
      langsArr,
    );

    return langsArr;
  }

  /**
   * Get languages list either as an array, or object (default)
   */
  function get(type) {
    return $q((resolve, reject) => {
      // Not found from cache, return $resource
      Languages.get()
        .$promise.then(languages => {
          // Format into array if requested
          const formattedLanguages =
            type === 'array' ? objectToArray(languages) : languages;
          resolve(formattedLanguages);
        })
        .catch(() => {
          reject();
        });
    });
  }
}
