'use strict';

angular.module('contacts').controller('AddContactController', ['$scope', '$rootScope', '$http', '$timeout', '$state', '$stateParams', '$location', 'Contact', 'UsersMini', 'Authentication',
  function($scope, $rootScope, $http, $timeout, $state, $stateParams, $location, Contact, UsersMini, Authentication) {

    // If user is not signed in then redirect to sign in form
    if (!Authentication.user) $location.path('signin');

    // If no friend ID defined, go to elsewhere
    if (!$stateParams.userId) $state.go('profile');

    $scope.user = Authentication.user;
    $scope.isConnected = false;
    $scope.isLoading = false;
    $scope.contact = {
      message: '<p>Hi!</p><p>I would like to add you as a contact.</p><p>— ' + Authentication.user.displayName + '</p>'
    };

    if($stateParams.userId === $scope.user._id) {
      $scope.isConnected = true;
      $scope.error = 'You cannot connect with yourself. That is just silly.';
    }

    $scope.friend = UsersMini.get({
        userId: $stateParams.userId
    });

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
