'use strict';

//Setting up route
angular.module('search').config(['$stateProvider',
  function($stateProvider) {
    // Search state routing
    $stateProvider.
    state('search', {
      url: '/search?location?offer',
      templateUrl: 'modules/search/views/search.client.view.html'
    });
  }
]);
