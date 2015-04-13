'use strict';

angular.module('contacts').controller('AddContactController', ['$scope', '$rootScope', '$http', '$timeout', '$state', '$stateParams', '$location', 'Contact', 'ContactBy', 'UsersMini', 'Authentication',
  function($scope, $rootScope, $http, $timeout, $state, $stateParams, $location, Contact, ContactBy, UsersMini, Authentication) {

    // If user is not signed in then redirect to sign in form
    if (!Authentication.user) $location.path('signin');

    // If no friend ID defined, go to elsewhere
    if (!$stateParams.userId) $state.go('profile');

    $scope.user = Authentication.user;
    $scope.isConnected = false;
    $scope.isLoading = false;
    $scope.contact = {
      message: '<p>Hi!</p><p>I would like to add you as a contact.</p><p>- ' + Authentication.user.displayName + '</p>'
    };

    // Fetch the profile of other party
    $scope.friend = UsersMini.get({
      userId: $stateParams.userId
    });

    // First fetch contact object, just to make it sure it exists + removing it is easier
    $scope.existingContact = ContactBy.get({
      userId: $stateParams.userId
    },function(contact){
      if(contact) {
        $scope.isConnected = true;
        $scope.success = (contact.confirmed) ? 'You two are already connected. Great!' : 'Connection already initiated; now it has to be confirmed.';
      }
    });

    // Prevent connecting with yourself
    if($stateParams.userId === $scope.user._id) {
      $scope.isConnected = true;
      $scope.error = 'You cannot connect with yourself. That is just silly.';
    }

    // Add contact
    $scope.addContact = function() {
      $scope.isLoading = true;

      var contact = new Contact({
        friendUserId: $stateParams.userId,
        message: $scope.contact.message
      });

      contact.$save(function(response) {
        $scope.isLoading = false;
        $scope.isConnected = true;
        $scope.success = 'Done! We sent an email to your contact and he/she still needs to confirm it.';
      }, function(errorResponse) {
        $scope.isLoading = false;
        $scope.error = errorResponse.data.message;
      });

    };

  }
]);
