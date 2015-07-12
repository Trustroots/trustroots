'use strict';

angular.module('core').directive('trLocation', [
  '$http',
  function($http) {
    return {
      replace: true,
      template:
        '<div class="form-group input-location">' +
          '<label for="input-{{id}}" class="sr-only">{{placeholder}}</label>' +
          '<input type="text" id="input-{{id}}" class="form-control" placeholder="{{placeholder}}" ng-model="trLocation" ng-keypress="enterLocation($event)" typeahead="trTitle as address.trTitle for address in searchSuggestions($viewValue)" typeahead-on-select="trLocation = placeTitle($item)" />' +
        '</div>',
      restrict: 'A',
      scope: {
        id: '=',
        trLocation: '='// Actual model to edit
      },
      controller: function($scope, $http, SettingsFactory) {

        var settings = SettingsFactory.get();

        if(!$scope.trLocation) $scope.trLocation = '';

        // Stop submitting surrounding form
        $scope.enterLocation = function (event) {
          if (event.which === 13) {
            event.preventDefault();
          }
        };

        /*
         * Search field's typeahead -suggestions
         *
         * @link https://www.mapbox.com/developers/api/geocoding/
         */
        $scope.searchSuggestions = function(val) {

          return $http
            .get('//api.tiles.mapbox.com/v4/geocode/mapbox.places-v1/' + val + '.json?access_token=' + settings.mapbox.publicKey)
            .then(function(response) {

              if(response.status === 200 && response.data.features && response.data.features.length > 0) {

                  return response.data.features.map(function(place){
                    place.trTitle = $scope.placeTitle(place);
                    return place;
                  });

              }
              else return [];
            });

        };

        /*
         * Compile a nice title for the place, eg. "Jyväskylä, Finland"
         */
        $scope.placeTitle = function(place) {
          var title = '';

          if(place.place_name) title += place.place_name;
          else if(place.text) title += place.text;

          return title;
        };

      },
      link: function (scope, element, attr, ctrl) {

        scope.placeholder = ( attr.placeholder ) ? attr.placeholder : 'Location...';

      }
    };
  }
]);
