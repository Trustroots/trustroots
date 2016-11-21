(function () {
  'use strict';

  // Read common contacts list by userId.
  // Returns a list of contacts currently
  // authenticated user has in common with profile.
  angular
    .module('contacts')
    .factory('ContactsCommonListService', ContactsCommonListService);

  /* @ngInject */
  function ContactsCommonListService($resource) {
    return $resource('/api/contacts/:listUserId/common', {
      listUserId: '@id'
    });
  }

}());
