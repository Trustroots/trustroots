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
        template: '<Admin></Admin>',
        requiresRole: 'admin',
        data: {
          pageTitle: 'Admin'
        }
      }).
      state('admin-search-users', {
        url: '/admin/search-users',
        template: '<AdminSearchUsers></AdminSearchUsers>',
        requiresRole: 'admin',
        data: {
          pageTitle: 'Admin: Search users'
        }
      });

  }

}());
