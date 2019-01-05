// (function () {
//   'use strict';

//   // Read common contacts list by userId.
//   // Returns a list of contacts currently
//   // authenticated user has in common with profile.
//   angular
//     .module('contacts')
//     .factory('ContactsCommonListService', ContactsCommonListService);

//   /* @ngInject */
//   function ContactsCommonListService($resource) {
//     return $resource('/api/contacts/:listUserId/common', {
//       listUserId: '@id'
//     });
//   }

// }());

'use strict';
var axios = require('axios');

exports = function ContactsCommonListService(id) {
  return (
    axios.get('/api/contacts/'+ id + '/common')
      .then(function (resp) {
        return resp.data;
      })
      .catch(function (error) {
        return error;
      })
  );
};
