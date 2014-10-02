'use strict';

angular.module('core').controller('FooterController', ['$scope', 'Authentication', 'Menus',
	function($scope, Authentication, Menus) {

		$scope.isTransparent = false;
		$scope.isHidden = false;

		// Changing footer styles after navigation
		$scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams){
		    $scope.isTransparent = (['home', 'forgot', 'signin', 'welcome'].indexOf(toState.name) > -1) ? true : false;
		    $scope.isHidden = (['listMessages'].indexOf(toState.name) > -1) ? true : false;
		});

	}
]);