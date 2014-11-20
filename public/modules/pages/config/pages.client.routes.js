'use strict';

// Setting up route
angular.module('pages').config(['$stateProvider', '$urlRouterProvider',
  function($stateProvider, $urlRouterProvider) {
    // Redirect to home view when route not found
    $urlRouterProvider.otherwise('/');

    // Home state routing
    $stateProvider.
    state('todo', {
      url: '/todo',
      templateUrl: 'modules/pages/views/todo.client.view.html'
    }).
    state('rules', {
      url: '/rules',
      templateUrl: 'modules/pages/views/rules.client.view.html'
    }).
    state('team', {
      url: '/team',
      templateUrl: 'modules/pages/views/team.client.view.html'
    }).
    state('contact', {
      url: '/contact',
      templateUrl: 'modules/pages/views/contact.client.view.html'
    }).
    state('about', {
      url: '/about',
      templateUrl: 'modules/pages/views/about.client.view.html'
    }).
    state('privacy', {
      url: '/privacy',
      templateUrl: 'modules/pages/views/privacy.client.view.html'
    }).
    state('home', {
      url: '/',
      templateUrl: 'modules/pages/views/home.client.view.html'
    });
  }
]);
