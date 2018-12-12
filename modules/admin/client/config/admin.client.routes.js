(function () {
  'use strict';

  angular
    .module('admin')
    .config(AdminRoutes);

  /* @ngInject */
  function AdminRoutes($stateProvider) {

    $stateProvider.
      state('admin', {
        url: '/admin',
        template: '<admin></admin>', // This should be lowercase
        requiresRole: 'admin',
        data: {
          pageTitle: 'Admin'
        }
      }).
      state('admin-search-users', {
        url: '/admin/search-users',
        template: '<admin-search-users></admin-search-users>', // Dashes are good here
        requiresRole: 'admin',
        data: {
          pageTitle: 'Admin: Search users'
        }
      });

  }

}());
