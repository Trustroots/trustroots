// Contact factory used for communicating with the contacts REST endpoints
// Read contact by contactId
angular.module('contacts').factory('Contact', ContactService);

/* @ngInject */
function ContactService($resource) {
  return $resource(
    '/api/contact/:contactId',
    {
      contactId: '@_id',
    },
    {
      get: {
        method: 'GET',
      },
      update: {
        method: 'PUT',
      },
      delete: {
        method: 'DELETE',
      },
    },
  );
}
