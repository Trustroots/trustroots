// ContactsList factory used for communicating with the contacts REST endpoints
// Read contact list by userId
angular.module('contacts').factory('ContactsListService', ContactsListService);

/* @ngInject */
function ContactsListService($resource) {
  return $resource('/api/contacts/:listUserId', {
    listUserId: '@id',
  });
}
