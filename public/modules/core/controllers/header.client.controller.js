'use strict';

angular.module('core').controller('HeaderController', ['$scope', '$log', '$filter', 'Authentication', 'Menus', 'Socket',
	function($scope, $log, $filter, Authentication, Menus, Socket) {

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

    // Create header menu for User when she/he logins
		// Will also upgrade menu when user.displayName changes
		var userMenuAdded = false;
    $scope.$watch('authentication.user.displayName', function() {
			if(Authentication.user) {

				// If menu is there, our job is just to upgrade it, thus clean old one away first
				if(userMenuAdded) Menus.removeMenuItem('topuserbar', 'profile');

				Menus.addMenuItem('topuserbar', $filter('limitTo')(Authentication.user.displayName, 35), 'profile', 'dropdown', '/profile');
				Menus.addSubMenuItem('topuserbar', 'profile', 'My profile', 'profile/' + Authentication.user.username, 'profile', null, null, 0, 'user');
				Menus.addSubMenuItem('topuserbar', 'profile', 'Edit profile', 'profile/' + Authentication.user.username + '/edit', 'profile-edit', null, null, 0, 'edit');
				Menus.addSubMenuItem('topuserbar', 'profile', 'Settings', 'profile/' + Authentication.user.username + '/settings', 'profile-settings', null, null, 0, 'cog');
				Menus.addSubMenuItem('topuserbar', 'profile', 'Help', 'contact', 'contact', null, null, 0, 'bolt');
				Menus.addSubMenuDivider('topuserbar', 'profile');
				Menus.addSubMenuItem('topuserbar', 'profile', 'Sign out', '/auth/signout', '/auth/signout', null, null, 0, 'sign-out');

				userMenuAdded = true;
		  }
    });

	}
]);
