import contactAddTemplateUrl from '@/modules/contacts/client/views/add-contact.client.view.html';
import contactConfirmTemplateUrl from '@/modules/contacts/client/views/confirm-contact.client.view.html';

angular.module('contacts').config(ContactsRoutes);

/* @ngInject */
function ContactsRoutes($stateProvider) {
  $stateProvider
    .state('contactAdd', {
      url: '/contact-add/:userId',
      templateUrl: contactAddTemplateUrl,
      requiresAuth: true,
      controller: 'ContactAddController',
      controllerAs: 'contactAdd',
      resolve: {
        // A string value resolves to a service
        ContactByService: 'ContactByService',
        UsersMini: 'UsersMini',

        existingContact(ContactByService, $stateParams) {
          return ContactByService.get({ userId: $stateParams.userId });
        },

        friend(UsersMini, $stateParams) {
          return UsersMini.get({
            userId: $stateParams.userId,
          });
        },
      },
      data: {
        pageTitle: 'Add contact',
      },
    })
    .state('contactConfirm', {
      url: '/contact-confirm/:contactId',
      templateUrl: contactConfirmTemplateUrl,
      requiresAuth: true,
      controller: 'ContactConfirmController',
      controllerAs: 'contactConfirm',
      resolve: {
        // A string value resolves to a service
        Contact: 'Contact',

        contact(Contact, $stateParams) {
          return Contact.get({ contactId: $stateParams.contactId });
        },
      },
      data: {
        pageTitle: 'Confirm contact',
      },
    });
}
