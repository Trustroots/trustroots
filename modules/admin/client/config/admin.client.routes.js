(function () {
  'use strict';

  angular
    .module('admin')
    .config(AdminRoutes);

  /* @ngInject */
  function AdminRoutes($stateProvider, $urlRouterProvider) {

    $urlRouterProvider.when('/admin');

    $stateProvider.
      state('volunteering', {
        url: '/volunteering',
        template: '<admin></admin>',
        data: {
          pageTitle: 'Admin'
        }
      });
  }

}());
