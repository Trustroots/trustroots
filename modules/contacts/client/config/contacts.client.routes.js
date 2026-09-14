angular.module('contacts').config(ContactsRoutes);

/* @ngInject */
function ContactsRoutes($stateProvider) {
  $stateProvider
    .state('contactAdd', {
      url: '/contact-add/:userId',
      requiresAuth: true,
      /* @ngInject */
      onEnter($window, $stateParams) {
        $window.location.assign(
          `/contact-add/${encodeURIComponent($stateParams.userId)}`,
        );
      },
      data: {
        pageTitle: 'Add contact',
      },
    })
    .state('contactConfirm', {
      url: '/contact-confirm/:contactId',
      requiresAuth: true,
      /* @ngInject */
      onEnter($window, $stateParams) {
        $window.location.assign(
          `/contact-confirm/${encodeURIComponent($stateParams.contactId)}`,
        );
      },
      data: { pageTitle: 'Confirm contact' },
    });
}
