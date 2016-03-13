(function(){
  'use strict';

  angular
    .module('core')
    .directive('trLocation', trLocationDirective);

  /* @ngInject */
  function trLocationDirective($http) {
    return {
      replace: true,
      template:
        '<div class="form-group input-location">' +
          '<label for="input-{{::id}}" class="sr-only">{{::placeholder}}</label>' +
          '<input type="text" id="input-{{::id}}" class="form-control" placeholder="{{::placeholder}}" ng-model="trLocation" ng-keypress="enterLocation($event)" uib-typeahead="trTitle as address.trTitle for address in searchSuggestions($viewValue)" typeahead-on-select="trLocation = placeTitle($item)" />' +
        '</div>',
      restrict: 'A',
      scope: {
        id: '=',
        trLocation: '=' // Actual model to edit
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
         * @link https://www.mapbox.com/api-documentation/#geocoding
         */
        $scope.searchSuggestions = function(val) {

          if(!settings.mapbox || !settings.mapbox.publicKey) {
            return [];
          }

          return $http
            .get(
              '//api.mapbox.com/geocoding/v5/mapbox.places/' + val + '.json' +
                '?access_token=' + settings.mapbox.publicKey +
                '&types=country,region,place,locality,neighborhood',
              {
                ignoreLoadingBar: true
              }
            )
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
          var title = '',
              titlePostfix = null;

          if(place.text) {
            title = place.text;

            // Relevant context strings
            if(place.context) {
              var contextLength = place.context.length;
              for (var i = 0; i < contextLength; i++) {
                if(place.context[i].id.substring(0, 6) === 'place.') {
                  title += ', ' + place.context[i].text;
                }
                else if(place.context[i].id.substring(0, 8) === 'country.') {
                  title += ', ' + place.context[i].text;
                }
              }
            }

          }
          else if(place.place_name) {
            title = place.place_name;
          }

          return title;
        };

      },
      link: function (scope, element, attr, ctrl) {

        scope.placeholder = ( attr.placeholder ) ? attr.placeholder : 'Location...';

      }
    };
  }

})();
