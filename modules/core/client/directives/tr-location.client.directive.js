(function(){
  'use strict';

  /**
   * Directive to extend <input> to have location auto suggestions
   *
   * Usage:
   * `<input type="text" tr-location>`
   *
   * Usage with Angular-UI-Leaflet:
   * `<input type="text" tr-location tr-location-center="leafletMapCenter" tr-location-bounds="leafletMapBounds">`
   *
   * You can also pass custom minimum length and delay options for Typeahead:
   * `<input type="text" tr-location typeahead-min-length="2" typeahead-wait-ms="100">`
   *
   * Defaults for these are
   * - typeahead-min-length: 3
   * - typeahead-wait-ms: 300
   *
   * Note that this directive will re-render input element using $compile.
   */
  angular
    .module('core')
    .directive('trLocation', trLocationDirective);

  /* @ngInject */
  function trLocationDirective($compile, $timeout, LocationService) {
    return {
      restrict: 'A',
      require: 'ngModel',
      scope: {
        value: '=ngModel',
        trLocationCenter: '=?', // `?` makes this optional
        trLocationBounds: '=?', // `?` makes this optional
      },
      replace: false,
      link: function (scope, element, attr, ngModel) {

        // Event handler to stop submitting the surrounding form
        element.bind('keydown keypress', function($event) {
           if ($event.which === 13) {
             $event.preventDefault();
           }
        });

        // Attach Angular UI Bootstrap TypeAhead
        element.attr('typeahead-min-length', attr.typeaheadMinLength ? parseInt(attr.typeaheadMinLength) : 3);
        element.attr('typeahead-wait-ms', attr.typeaheadWaitMs ? parseInt(attr.typeaheadWaitMs) : 300);
        element.attr('typeahead-on-select', 'trLocation.onSelect($item, $model, $label, $event)');
        element.attr('uib-typeahead', 'trTitle as address.trTitle for address in trLocation.searchSuggestions($viewValue)');

        // Stop infinite rendering on $compile
        element.removeAttr('tr-location');

        $compile(element)(scope);

        // Without this input value would be left empty due $compile
        // @todo: any better way of handling this?
        $timeout(function() {
          ngModel.$setViewValue(scope.value);
          ngModel.$render();
        });

      },
      controllerAs: 'trLocation',
      controller: function($scope, $timeout) {

        // View Model
        var vm = this;

        vm.searchSuggestions = searchSuggestions;
        vm.onSelect = onSelect;

        /**
         * Get geolocation suggestions
         */
        function searchSuggestions(query) {
          return LocationService.suggestions(query);
        }

        /**
         * When selecting autosuggested location
         */
        function onSelect($item, $model, $label, $event) {
          $timeout(function() {
            $scope.value = $label;
          });

          // Set center bounds for (Angular-UI-Leaflet) model
          // Bounds is prioritized over center
          var bounds = LocationService.getBounds($item);
          if(angular.isObject($scope.trLocationBounds) && bounds) {
            $scope.trLocationBounds = bounds;
          }
          // If no bounds was found, check `center`
          // Set center coordinates for (Angular-UI-Leaflet) model
          else if(angular.isObject($scope.trLocationCenter)) {
            var center = LocationService.getCenter($item);
            if(center) {
              angular.extend($scope.trLocationCenter, center);
            }
          }

        }

      }
    };
  }

})();
