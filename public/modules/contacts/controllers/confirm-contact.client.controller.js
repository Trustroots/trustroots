'use strict';

angular.module('contacts').controller('ConfirmContactController', ['$scope', '$rootScope', '$http', '$timeout', '$state', '$stateParams', '$location', 'Contact', 'Authentication',
  function($scope, $rootScope, $http, $timeout, $state, $stateParams, $location, Contact, Authentication) {

    // If user is not signed in then redirect to sign in form
    if (!Authentication.user) $location.path('signin');

    // If no friend ID defined, go to elsewhere
    if (!$stateParams.contactId) {
      $scope.error = 'Missing confirmation code.';
    }

    $scope.user = Authentication.user;
    $scope.isConnected = false;
    $scope.isLoading = true;

    // First fetch contact object, just to make it sure it exists + removing it is easier
    $scope.contact = Contact.get({
      contactId: $stateParams.contactId
    },
    // Got contact
    function(contact) {
      $scope.isLoading = false;
      if(!contact) $scope.error = 'There is no such contact request. Send a new contact request his/hers from profile page.';
      if(contact.confirmed === true) {
        $scope.isConnected = true;
        $scope.success = 'You two are already connected. Great!';
      }
      else if (contact.users[0]._id !== Authentication.user._id) {
        $scope.error = 'You must wait until he/she confirms your connection.';
      }
    },
    // Error getting contact
    function(errorResponse) {
      switch (errorResponse.status) {
        case 403:
            $scope.isWrongCode = true;
            $scope.error = 'Could not find confirmation code for you. Check the confirmation link from email or you might be logged in with wrong user?';
          break;
        default:
          $scope.isWrongCode = true;
          $scope.error = 'Something went wrong. Try again.';
      }
    });

    $scope.confirmContact = function() {
      $scope.isLoading = true;
      $scope.contact.confirm = true;
      $scope.contact.$update(function(response) {
        $scope.isLoading = false;
        $scope.isConnected = true;
        $scope.success = 'You two are now connected!';
      }, function(errorResponse) {
        $scope.isLoading = false;
        $scope.error = errorResponse.data.message;
      });

    };

  }
]);
