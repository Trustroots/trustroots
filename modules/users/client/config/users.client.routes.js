(function() {
  'use strict';

  angular
    .module('users')
    .config(UsersRoutes);

  /* @ngInject */
  function UsersRoutes($stateProvider) {

    $stateProvider.
      // Users state routing
      state('welcome', {
        url: '/welcome',
        templateUrl: 'modules/users/views/authentication/welcome.client.view.html',
        requiresAuth: true,
        footerTransparent: true
      }).
      state('profile-edit', {
        url: '/profile/:username/edit',
        templateUrl: 'modules/users/views/profile/edit-profile.client.view.html',
        requiresAuth: true,
        controller: 'EditProfileController',
        controllerAs: 'editprofile',
        resolve: {
          // A string value resolves to a service
          SettingsService: 'SettingsService',
          appSettings: function(SettingsService) {
            return SettingsService.get();
          }
        }
      }).
      state('profile-settings', {
        url: '/profile/:username/settings',
        templateUrl: 'modules/users/views/profile/edit-settings.client.view.html',
        requiresAuth: true,
        controller: 'SettingsController',
        controllerAs: 'settings',
        resolve: {
          // A string value resolves to a service
          SettingsService: 'SettingsService',
          appSettings: function(SettingsService) {
            return SettingsService.get();
          }
        }
      }).
      state('profile', {
        url: '/profile/:username?tab&updated',
        controller: 'ProfileController',
        templateUrl: 'modules/users/views/profile/view-profile.client.view.html',
        controllerAs: 'profileCtrl',
        requiresAuth: true,
        resolve: {
          // A string value resolves to a service
          UserProfilesService: 'UserProfilesService',
          SettingsService: 'SettingsService',

          profile: function(UserProfilesService, $stateParams) {
            return UserProfilesService.get({
              username: $stateParams.username
            });
          },
          appSettings: function(SettingsService) {
            return SettingsService.get();
          }
        }
      }).

      // Auth routes
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

})();
