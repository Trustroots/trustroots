'use strict';

// Setting up route
angular.module('users').config(['$stateProvider',
  function($stateProvider) {
    // Users state routing
    $stateProvider.
    state('welcome', {
      url: '/welcome',
      templateUrl: 'modules/users/views/authentication/welcome.client.view.html',
      requiresAuth: true,
      footerTransparent: true
    }).
    state('profile-edit', {
      url: '/profile/:username/edit',
      templateUrl: 'modules/users/views/profile/edit-profile.client.view.html',
      requiresAuth: true
    }).
    state('profile-settings', {
      url: '/profile/:username/settings',
      templateUrl: 'modules/users/views/profile/edit-settings.client.view.html',
      requiresAuth: true
    }).
    state('profile', {
      url: '/profile/:username?tab',
      templateUrl: 'modules/users/views/profile/view-profile.client.view.html',
      requiresAuth: true
    }).
    state('profile-updated', {
      url: '/profile/:username/?updated',
      templateUrl: 'modules/users/views/profile/view-profile.client.view.html',
      requiresAuth: true
    }).
    state('profile-tab', {
      url: '/profile/:username/:tab',
      templateUrl: 'modules/users/views/profile/view-profile.client.view.html',
      requiresAuth: true
    }).

    // Sign in
    state('signup', {
      url: '/signup',
      templateUrl: 'modules/users/views/authentication/signup.client.view.html',
      footerTransparent: true,
      headerHidden: true
    }).
    state('signin', {
      url: '/signin',
      templateUrl: 'modules/users/views/authentication/signin.client.view.html',
      footerTransparent: true,
      headerHidden: true
    }).
    state('signin-continue', {
      url: '/signin/?continue',
      templateUrl: 'modules/users/views/authentication/signin.client.view.html',
      footerTransparent: true,
      headerHidden: true
    }).
    state('confirm-email', {
      url: '/confirm-email/:token?signup',
      templateUrl: 'modules/users/views/authentication/confirm-email.client.view.html',
      footerTransparent: true
    }).

    // Password reset
    state('forgot', {
      url: '/password/forgot',
      templateUrl: 'modules/users/views/password/forgot-password.client.view.html',
      footerTransparent: true
    }).
    state('reset-invalid', {
      url: '/password/reset/invalid',
      templateUrl: 'modules/users/views/password/reset-password-invalid.client.view.html',
      footerTransparent: true
    }).
    state('reset-success', {
      url: '/password/reset/success',
      templateUrl: 'modules/users/views/password/reset-password-success.client.view.html',
      footerTransparent: true
    }).
    state('reset', {
      url: '/password/reset/:token',
      templateUrl: 'modules/users/views/password/reset-password.client.view.html',
      footerTransparent: true
    });

  }
]);
