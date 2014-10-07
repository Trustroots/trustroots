'use strict';

angular.module('core').controller('HeaderController', ['$scope', '$log', 'Authentication', 'Menus', 'Socket',
	function($scope, $log, Authentication, Menus, Socket) {

		// @todo: show info popup when this happens
    Socket.on('reconnect', function () {
      $log.log('Reconnected to the server');
    });

    Socket.on('reconnecting', function () {
      $log.log('Attempting to re-connect to the server');
    });

		$scope.authentication = Authentication;
		$scope.isCollapsed = false;
		$scope.isHidden = false;
		$scope.commonMenu = Menus.getMenu('topbar');
		$scope.userMenu = Menus.getMenu('topuserbar');

		$scope.toggleCollapsibleMenu = function() {
			$scope.isCollapsed = !$scope.isCollapsed;
		};

		// Collapsing the menu after navigation
		// Hide it at certain pages
		$scope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {
			$scope.isCollapsed = false;
		    $scope.isHidden = (['home', 'signup', 'signin'].indexOf(toState.name) > -1) ? true : false;
		});

	}
]);
