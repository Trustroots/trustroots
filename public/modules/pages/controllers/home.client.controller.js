'use strict';


angular.module('pages').controller('HomeController', ['$scope', '$state', '$log', 'Authentication',
	function($scope, $state, $log, Authentication) {
		// This provides Authentication context.
		$scope.authentication = Authentication;

		// Redirect logged-in users out from front page
        if( $scope.authentication.user ) {
            $log.log('Auth user hit the home - redirect to search instead...');
            $state.go('search');
		}
	}
]);