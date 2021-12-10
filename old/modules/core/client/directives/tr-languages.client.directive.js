/**
 * Directive to select languages
 *
 * Accepts and ouputs a list of language keys:
 * `['fi_FI', 'fr_FR', ...]`
 *
 * Usage:
 * ```
 * <div tr-languages="scopeVariable"></div>
 * ```
 *
 * Since directive is transcluded, you can do so:
 * ```
 * <div tr-languages="scopeVariable"
        ng-change="changed()"
        aria-label="Demo languages"></div>
 * ```
 */
angular.module('core').directive('trLanguages', trLanguagesDirective);

/* @ngInject */
function trLanguagesDirective() {
  const directive = {
    restrict: 'A',
    replace: true,
    transclude: true,
    template:
      '<select multiple chosen' +
      '  class="form-control"' +
      '  placeholder-text-multiple="\'Type to search...\'"' +
      '  no-results-text="\'Not found: \'"' +
      '  search-contains="true"' +
      '  ng-model="trLanguages.selectedLanguages"' +
      '  ng-options="language.name for language in ::trLanguages.languages track by language.key">' +
      '</select>',
    scope: {
      output: '=trLanguages',
      onChange: '@trLanguagesOnChange',
    },
    controller: trLanguagesDirectiveController,
    controllerAs: 'trLanguages',
  };

  return directive;

  /* @ngInject */
  function trLanguagesDirectiveController($scope, Languages) {
    // View model
    const vm = this;

    // Exposed to the view
    vm.languages = Languages.get('array');
    vm.selectedLanguages = [];

    activate();

    /**
     * Initialize controller
     */
    function activate() {
      // Ensure output is always an array, even on initialization
      if (!$scope.output || !angular.isArray($scope.output)) {
        $scope.output = [];
      }

      // Pick previously populated languages
      decodeSelectedLanguages();

      // Watch for changes in select and encode to array on changes
      $scope.$watch(
        'trLanguages.selectedLanguages',
        function (newValue, oldValue) {
          if (newValue.length !== oldValue.length) {
            encodeSelectedLanguages();
          }
        },
      );
    }

    /**
     * Formats array for Chosen selector:
     * `[{'fi_FI': 'Finnish'}, {'fr_FR': 'French'}, ... }]`
     *
     * This array is used only internally for this directive.
     */
    function decodeSelectedLanguages() {
      const selections = [];
      if ($scope.output.length > 0) {
        $scope.output.forEach(function (key) {
          if (angular.isString(key)) {
            this.push({
              key,
              name: vm.languages[key],
            });
          }
        }, selections);
        vm.selectedLanguages = selections;
      }
    }

    /**
     * Formats array of language keys from Chosen array:
     * `['fi_FI', 'fr_FR', ...]`
     *
     * This is the output format for this directive.
     */
    function encodeSelectedLanguages() {
      const keys = [];
      angular.forEach(
        vm.selectedLanguages,
        function (language) {
          this.push(String(language.key));
        },
        keys,
      );
      $scope.output = keys;
    }
  }
}
