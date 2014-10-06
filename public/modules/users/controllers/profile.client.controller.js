'use strict';

angular.module('users').controller('ProfileController', ['$scope', '$stateParams', '$state', '$location', '$log', '$modal', 'Users', 'UserProfiles', 'Authentication',
	function($scope, $stateParams, $state, $location, $log, $modal, Users, UserProfiles, Authentication) {

		$scope.user = Authentication.user; // Currently logged in user
		$scope.profile = false; // Profile to show

	  // We landed here from profile editor, show success message
		// @todo: nice notifications https://github.com/Trustroots/trustroots/issues/24
	  if($stateParams.updated) {
			$log.log('Profile updated');
		}

		// If user is not signed in then redirect back home
		if (!$scope.user) $location.path('signin');

    // Fetch profile to show (note: not the currently logged in user's profile)
		$scope.findProfile = function() {
		    if(!$stateParams.username) {
		      // No username set, direct to your own profile
					$state.go('profile', {username: $scope.user.username});
		    }
		    else {
		      // Get profile for $stateParams.username
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
				path: 'overview',
				title: 'Overview',
				content: '/modules/users/views/profile/tab-profile-overview.client.view.html',
				active: $stateParams.tab && $stateParams.tab === 'overview'
			},
    	{
				path: 'references',
				title: 'References',
				content: '/modules/references/views/list-references.client.view.html',
				active: $stateParams.tab && $stateParams.tab === 'references'
			},
    	{
				path: 'contacts',
				title: 'Contacts',
				content: '/modules/users/views/profile/tab-profile-contacts.client.view.html',
				active: $stateParams.tab && $stateParams.tab === 'contacts'
			}
  	];

		$scope.tabSelect = function(tabPath) {
			$log.log(tabPath);
			// @link http://angular-ui.github.io/ui-router/site/#/api/ui.router.state.$state
			// @todo: change path here?
		};

	  // Birthday input field
	  // @link http://angular-ui.github.io/bootstrap/#/datepicker
		$scope.birthdateFormat = 'dd-MMMM-yyyy';
		$scope.birthdateMin = new Date(99,0,0);
		$scope.birthdateMax = new Date();
		$scope.birthdateOpened = false;
		$scope.birthdateOptions = {
			formatYear: 'yy', // Format of year in year range
			startingDay: 1, // Starting day of the week from 0-6 (0=Sunday, ..., 6=Saturday)
			yearRange: 40 // Number of years displayed in year selection
		};
		$scope.birthdateOpen = function($event) {
    	$event.preventDefault();
    	$event.stopPropagation();
    	$scope.birthdateOpened = true;
  	};


		/**
		* Open write/update reference -modal
		*/
		$scope.referenceModal = function (userTo, $event) {

			if($event) $event.preventDefault();

			var modalInstance = $modal.open({
				templateUrl: '/modules/references/views/create-reference.client.modal.html',
				controller: function ($scope, $modalInstance) {
					$scope.profile = profile;
					$scope.cancel = function () {
						$modalInstance.dismiss('cancel');
					};
				}
			});
		};

	}
]);
