'use strict';

// Setting up route
angular.module('users').config(['$stateProvider',
  function($stateProvider) {
    // Users state routing
    $stateProvider.
    state('welcome', {
      url: '/welcome',
      templateUrl: 'modules/users/views/authentication/welcome.client.view.html'
    }).
    state('profile-edit', {
      url: '/profile/:username/edit',
      templateUrl: 'modules/users/views/profile/edit-profile.client.view.html'
    }).
    state('profile-settings', {
      url: '/profile/:username/settings',
      templateUrl: 'modules/users/views/profile/edit-settings.client.view.html'
    }).
    state('profile', {
      url: '/profile/:username',
      templateUrl: 'modules/users/views/profile/view-profile.client.view.html'
    }).
    state('profile-updated', {
      url: '/profile/:username/?updated',
      templateUrl: 'modules/users/views/profile/view-profile.client.view.html'
    }).
    state('profile-tab', {
      url: '/profile/:username/:tab',
      templateUrl: 'modules/users/views/profile/view-profile.client.view.html'
    }).
    state('profile-reference', {
      url: '/profile/:username/references/:referenceId',
      templateUrl: 'modules/users/views/profile/view-profile.client.view.html'
    }).
    state('signup', {
      url: '/signup',
      templateUrl: 'modules/users/views/authentication/signup.client.view.html'
    }).
    state('signin', {
      url: '/signin',
      templateUrl: 'modules/users/views/authentication/signin.client.view.html'
    }).
    state('forgot', {
      url: '/password/forgot',
      templateUrl: 'modules/users/views/password/forgot-password.client.view.html'
    }).
    state('reset-invalid', {
      url: '/password/reset/invalid',
      templateUrl: 'modules/users/views/password/reset-password-invalid.client.view.html'
    }).
    state('reset-success', {
      url: '/password/reset/success',
      templateUrl: 'modules/users/views/password/reset-password-success.client.view.html'
    }).
    state('reset', {
      url: '/password/reset/:token',
      templateUrl: 'modules/users/views/password/reset-password.client.view.html'
    });
  }
]);
