(function () {
  angular
    .module('contacts')
    .config(ContactsRoutes);

  /* @ngInject */
  function ContactsRoutes($stateProvider) {

    $stateProvider.
      state('contactAdd', {
        url: '/contact-add/:userId',
        templateUrl: '/modules/contacts/views/add-contact.client.view.html',
        requiresAuth: true,
        controller: 'ContactAddController',
        controllerAs: 'contactAdd',
        resolve: {
          // A string value resolves to a service
          ContactByService: 'ContactByService',
          UsersMini: 'UsersMini',

          existingContact: function (ContactByService, $stateParams) {
            return ContactByService.get({ userId: $stateParams.userId });
          },

          friend: function (UsersMini, $stateParams) {
            return UsersMini.get({
              userId: $stateParams.userId
            });
          }
        },
        data: {
          pageTitle: 'Add contact'
        }
      }).
      state('contactConfirm', {
        url: '/contact-confirm/:contactId',
        templateUrl: '/modules/contacts/views/confirm-contact.client.view.html',
        requiresAuth: true,
        controller: 'ContactConfirmController',
        controllerAs: 'contactConfirm',
        resolve: {
          // A string value resolves to a service
          Contact: 'Contact',

          contact: function (Contact, $stateParams) {
            return Contact.get({ contactId: $stateParams.contactId });
          }

        },
        data: {
          pageTitle: 'Confirm contact'
        }
      });

  }
}());
