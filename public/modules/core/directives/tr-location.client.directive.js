'use strict';

/* This declares to JSHint that 'settings' is a global variable: */
/*global settings:false */

angular.module('core').directive('trLocation', [
  '$http',
  function($http) {
    return {
      replace: true,
      template:
        '<div class="form-group">' +
          '<label for="input-{{id}}" class="sr-only">{{placeholder}}</label>' +
          '<input type="text" id="input-{{id}}" class="form-control" placeholder="{{placeholder}}" data-ng-model="location" ng-keypress="enterLocation($event)" typeahead="trTitle as address.trTitle for address in searchSuggestions($viewValue) | filter:{trTitle:$viewValue}" typeahead-on-select="setLocation($item)" />' +
        '</div>',
      restrict: 'A',
      scope: {
        id: '=',
        location: '='// Actual model to edit
      },
      controller: function($scope, $http) {

        /**
        * Location address search
        * 13 = enter key
        */
        $scope.location = '';
        $scope.enterLocation = function (event) {
          if (event.which === 13) {
            event.preventDefault();
            $scope.searchLocation();
          }
        };
        $scope.searchLocation = function () {
          if($scope.location !== '') {

            $http.get('http://api.geonames.org/searchJSON?featureClass=A&featureClass=P', {
              params: {
                q: $scope.location,
                maxRows: 10,
                lang: 'en',
                style: 'full', // 'full' since we need bbox
                type: 'json',
                username: settings.geonames.username
              }
            }).then(function(response){

              if(response.status === 200 && response.data.geonames) {
                if(response.data.geonames.length > 0) {

                  $scope.mapLocate(response.data.geonames[0]);

                }
                else {
                  // @Todo: nicer alert https://github.com/Trustroots/trustroots/issues/24
                  alert('Whoop! We could not find such a place...');
                }
              }
            });

          }
        };


        /*
        * Selecting search suggestions from the suggestions list
        */
        $scope.setLocation = function(place) {

          // Show full place name at search  query
          $scope.location =  $scope.placeTitle(place);

        };


        /*
        * Search field's typeahead -suggestions
        *
        * featureClass is twice already at URL due limitations with $http.get()
        *
        * @link http://www.geonames.org/export/geonames-search.html
        * @link http://www.geonames.org/export/codes.html
        */
        $scope.searchSuggestions = function(val) {

          return $http.get('http://api.geonames.org/searchJSON?featureClass=A&featureClass=P', {
            params: {
              q: val,
              maxRows: 5,
              lang: 'en',
              style: 'full', // 'full' since we need bbox
              type: 'json',
              username: settings.geonames.username
            }
          }).then(function(response){
            if(response.status === 200 && response.data.geonames.length > 0) {
              return response.data.geonames.map(function(place){
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

          // Prefer toponym name like 'Jyväskylä' instead of 'Jyvaskyla'
          if(place.toponymName) title += place.toponymName;
          else if(place.name) title += place.name;

          if(place.countryName) {
            if(title !== '') title += ', ';
            title += place.countryName;
          }

          return title;
        };



      },
      link: function (scope, element, attr, ctrl) {

        scope.placeholder = ( attr.placeholder ) ? attr.placeholder : 'Location...';

      }
    };
  }
]);
