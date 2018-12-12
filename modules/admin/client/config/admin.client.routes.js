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
        template: '<admin></admin>',
        requiresRole: 'admin',
        data: {
          pageTitle: 'Admin'
        }
      });
  }

}());
