'use strict';

angular.module('contacts').controller('RemoveContactController', ['$scope', '$state', '$stateParams', '$modal', 'Contact', 'Authentication',
  function($scope, $state, $stateParams, $modal, Contact, Authentication) {

    /**
    * Open write/update reference -modal
    */
    $scope.RemoveContactModal = function (contactId, $event) {
      if($event) $event.preventDefault();

      // If user is not signed in then redirect to sign in form
      if (!Authentication.user) $state.go('signin');

      $modal.open({
        templateUrl: '/modules/contacts/views/remove-contact.client.modal.html',
        controller: function ($scope, $modalInstance) {

          $scope.isLoading = true;

          // First fetch contact object, just to make it sure it exists + removing it is easier
          $scope.$parent.contact = Contact.get({
            contactId: contactId
          },function(contact){
            $scope.isLoading = false;
            if(!contact) $scope.error = 'You two are not connected yet.';
          }, function(errorResponse) {
            switch (errorResponse.status) {
              case 403:
                  $scope.error = 'No confirmation like this found.';
                break;
              default:
                $scope.error = 'Something went wrong. Try again.';
            }
          });

          $scope.removeContact = function() {
            $scope.isLoading = true;
            $scope.contact.$remove(function(res) {
              $scope.isLoading = false;
              $modalInstance.dismiss('cancel');

              // Reload page
              $state.transitionTo($state.current, $stateParams, {
                  reload: true,
                  inherit: false,
                  notify: true
              });
            });
          };

          // Close modal
          $scope.cancel = function () {
            $modalInstance.dismiss('cancel');
          };
        }
      });
    };

  }
]);
