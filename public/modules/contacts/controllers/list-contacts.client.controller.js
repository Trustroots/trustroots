'use strict';

angular.module('contacts').controller('ListContactsController', ['$scope', '$state', '$location', '$timeout', 'ContactList', 'Authentication',
  function($scope, $state, $location, $timeout, ContactList, Authentication) {

    // If user is not signed in then redirect to sign in form
    if (!Authentication.user) $location.path('signin');

    // Wait for profile from parent Controller (probably ProfileController)
    $scope.$parent.profile.$promise.then(function(profile) {
      $scope.contacts = ContactList.query({
        listUserId: profile._id
      });
    });

  }
]);
