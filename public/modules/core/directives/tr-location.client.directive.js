'use strict';

angular.module('core').directive('trLocation', [
  '$http',
	function($http) {
		return {
			template: '<input type="text" ng-model="location" placeholder="Location..." typeahead="trTitle as address.trTitle for address in getLocation($viewValue) | filter:{trTitle:$viewValue}" typeahead-loading="loadingLocations" class="form-control">' +
    						'<i ng-show="loadingLocations" class="glyphicon glyphicon-refresh"></i>',
			restrict: 'EA',
			controller: function($scope, $http) {

 				$scope.getLocation = function(val) {

					// http://www.geonames.org/export/geonames-search.html
					return $http.get('http://api.geonames.org/searchJSON', {
		      		params: {
        			q: val,
        			maxRows: 10,
							lang: 'en',
							featureClass: 'P', // P for city, A for country - http://www.geonames.org/export/codes.html
							style: 'full',
							username: 'trustroots'
      			}
    			}).then(function(response){
      			return response.data.geonames.map(function(place){

        			var title = '';

							// Prefer toponym name like 'Jyväskylä' instead of 'Jyvaskyla'
							if(place.toponymName) title += place.toponymName;
							else if(place.name) title += place.name;

							if(place.countryName) title += ', ' + place.countryName;

							place.trTitle = title;

							return place;
      			});
    			});
  			};


			}
		};
	}
]);
