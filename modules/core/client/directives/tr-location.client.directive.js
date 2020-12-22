/**
 * Directive to extend <input> to have location auto suggestions
 *
 * Based on Typeahead (ui.bootstrap.typeahead)
 * @link http://angular-ui.github.io/bootstrap/#!#typeahead
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
angular.module('core').directive('trLocation', trLocationDirective);

/* @ngInject */
function trLocationDirective($compile, $timeout, LocationService) {
  return {
    restrict: 'A',
    require: 'ngModel',
    scope: {
      value: '=ngModel',
      // `?` makes these optional
      limitLocationTypes: '=?',
      trLocationChange: '=?',
      trLocationNotfound: '=?',
      trLocationCenter: '=?',
      trLocationBounds: '=?',
    },
    replace: false,
    link(scope, element, attr, ngModel) {
      // Event handler to stop submitting the surrounding form
      element.bind('keydown keypress focus', function ($event) {
        scope.trLocationNotfound = false;

        // On enter
        if ($event.which === 13) {
          // Signal to controller that enter was pressed
          scope.skipSuggestions = true;
          $event.preventDefault();
        } else {
          scope.skipSuggestions = false;
        }
      });

      // Attach Angular UI Bootstrap TypeAhead
      // @link http://angular-ui.github.io/bootstrap/#!#typeahead
      element.attr(
        'typeahead-min-length',
        attr.typeaheadMinLength ? parseInt(attr.typeaheadMinLength, 10) : 3,
      );
      element.attr(
        'typeahead-wait-ms',
        attr.typeaheadWaitMs ? parseInt(attr.typeaheadWaitMs, 10) : 300,
      );
      element.attr(
        'typeahead-on-select',
        'trLocation.onSelect($item, $model, $label, $event)',
      );
      element.attr(
        'uib-typeahead',
        'trTitle as address.trTitle for address in trLocation.searchSuggestions(' +
          getQueryParameters(scope.limitLocationTypes) +
          ')',
      );

      function getQueryParameters(limitLocationTypes) {
        return limitLocationTypes
          ? '$viewValue, "country,region,place,locality,neighborhood"'
          : '$viewValue';
      }

      // Stop infinite rendering on $compile
      element.removeAttr('tr-location');

      $compile(element)(scope);

      // Without this input value would be left empty due $compile
      // @todo: any better way of handling this?
      $timeout(function () {
        ngModel.$setViewValue(scope.value);
        ngModel.$render();
      });
    },
    controllerAs: 'trLocation',
    controller($scope, $timeout) {
      // View Model
      const vm = this;

      vm.searchSuggestions = searchSuggestions;
      vm.onSelect = onSelect;

      /**
       * Get geolocation suggestions
       */
      function searchSuggestions(query, types) {
        $scope.trLocationNotfound = false;
        return LocationService.suggestions(query, types).then(function (
          suggestions,
        ) {
          // Enter was pressed before we got these results, thus just pick first
          if ($scope.skipSuggestions) {
            $scope.skipSuggestions = false;
            if (suggestions.length) {
              locate(suggestions[0]);
              $scope.value = suggestions[0].trTitle;
            } else {
              // Don't return suggestions list
              $scope.trLocationNotfound = query;
            }
            // Don't return suggestions list
            return [];
          } else {
            // Return suggestions list
            return suggestions;
          }
        });
      }

      /**
       * When selecting autosuggested location
       */
      function onSelect($item, $model, $label) {
        $timeout(function () {
          $scope.value = $label;
        });
        locate($item);
      }

      /**
       * Modify `trLocationCenter` or `trLocationBounds` objects
       */
      function locate(location) {
        // Set center bounds and center coordinates for (Angular-UI-Leaflet) model
        const bounds = LocationService.getBounds(location);
        const center = LocationService.getCenter(location);

        if (angular.isObject($scope.trLocationBounds) && bounds) {
          $scope.trLocationBounds = bounds;
        } else if (angular.isObject($scope.trLocationCenter) && center) {
          angular.extend($scope.trLocationCenter, center);
        } else if (angular.isFunction($scope.trLocationChange) && bounds) {
          $scope.trLocationChange(bounds, 'bounds');
        } else if (angular.isFunction($scope.trLocationChange) && center) {
          $scope.trLocationChange(center, 'center');
        }
      }
    },
  };
}
