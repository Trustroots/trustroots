'use strict';

// Configuring the Users module
angular.module('users').run(['Menus', 'Authentication',
	function(Menus, Authentication) {

		// Set top bar menu items
		Menus.addMenuItem('topuserbar', Authentication.user.displayName, 'profile', 'dropdown', '/profile');
		Menus.addSubMenuItem('topuserbar', 'profile', 'My profile', 'profile/' + Authentication.user.username, 'profile', null, null, 0, 'user');
		Menus.addSubMenuItem('topuserbar', 'profile', 'Edit profile', 'profile/' + Authentication.user.username + '/edit', 'profile-edit', null, null, 0, 'edit');
		Menus.addSubMenuItem('topuserbar', 'profile', 'Settings', 'profile/' + Authentication.user.username + '/settings', 'profile-settings', null, null, 0, 'cog');
		Menus.addSubMenuItem('topuserbar', 'profile', 'Help', 'contact', 'contact', null, null, 0, 'bolt');
		Menus.addSubMenuDivider('topuserbar', 'profile');
		Menus.addSubMenuItem('topuserbar', 'profile', 'Sign out', '/auth/signout', '/auth/signout', null, null, 0, 'sign-out');
	}
]);

// Config HTTP Error Handling
angular.module('users').config(['$httpProvider',
	function($httpProvider) {
		// Set the httpProvider "not authorized" interceptor
		$httpProvider.interceptors.push(['$q', '$location', 'Authentication',
			function($q, $location, Authentication) {
				return {
					responseError: function(rejection) {
						switch (rejection.status) {
							case 401:
								// Deauthenticate the global user
								Authentication.user = null;

								// Redirect to signin page
								$location.path('signin');
								break;
							case 403:
								// Add unauthorized behaviour
								break;
						}

						return $q.reject(rejection);
					}
				};
			}
		]);
	}
]);
