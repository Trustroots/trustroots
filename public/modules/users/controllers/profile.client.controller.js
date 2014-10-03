'use strict';

angular.module('users').controller('ProfileController', ['$scope', '$stateParams', '$location', '$log', 'Users', 'UserProfiles', 'Authentication',
	function($scope, $stateParams, $location, $log, Users, UserProfiles, Authentication) {

		$scope.user = Authentication.user; // Currently logged in user
		$scope.profile = false; // Profile to show

		// If user is not signed in then redirect back home
		if (!$scope.user) $location.path('signin');

        // Fetch profile to show (note: not the currently logged in user's profile)
		$scope.findProfile = function() {
		    if(!$stateParams.username) {
		        $log.log('No username set, showing your own profile');
                $scope.profile = $scope.user;
		    }
		    else {
		        $log.log('Get profile for '+ $stateParams.username);
                $scope.profile = UserProfiles.get({
                    username: $stateParams.username
                });
		    }
		};

		// Check if there are additional accounts
		$scope.hasConnectedAdditionalSocialAccounts = function(provider) {
			for (var i in $scope.profile.additionalProvidersData) {
				return true;
			}

			return false;
		};

		// Check if provider is already in use with profile
		$scope.isConnectedSocialAccount = function(provider) {
			return $scope.profile.provider === provider || ($scope.profile.additionalProvidersData && $scope.profile.additionalProvidersData[provider]);
		};


  	$scope.tabs = [
			{
				title: 'Overview',
				content: '/modules/users/views/profile/tab-profile-overview.client.view.html',
				active: true
			},
    	{
				title: 'References',
				content: '/modules/users/views/profile/tab-profile-references.client.view.html',
			},
    	{
				title: 'Contacts',
				content: '/modules/users/views/profile/tab-profile-contacts.client.view.html',
			}
  	];

	}
]);
