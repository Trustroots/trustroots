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
    state('donate', {
      url: '/donate',
      templateUrl: 'modules/pages/views/donate.client.view.html'
    }).
    state('faq', {
      url: '/faq',
      templateUrl: 'modules/pages/views/faq.client.view.html'
    }).
    state('foundation', {
      url: '/foundation',
      templateUrl: 'modules/pages/views/foundation.client.view.html'
    }).
    state('media', {
      url: '/media',
      templateUrl: 'modules/pages/views/media.client.view.html'
    }).
    state('home', {
      url: '/',
      templateUrl: 'modules/pages/views/home.client.view.html'
    });
  }
]);
