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
        title: 'Welcome',
        templateUrl: 'modules/users/views/authentication/welcome.client.view.html',
        requiresAuth: true,
        footerTransparent: true
      }).
      state('profile-edit', {
        url: '/profile/edit',
        title: 'Edit profile',
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
        url: '/profile/settings',
        title: 'Profile settings',
        templateUrl: 'modules/users/views/profile/edit-settings.client.view.html',
        controller: 'SettingsController',
        controllerAs: 'settings',
        requiresAuth: true
      }).
      state('profile', {
        url: '/profile/:username?tab&updated',
        title: 'Profile',
        templateUrl: 'modules/users/views/profile/view-profile.client.view.html',
        controller: 'ProfileController',
        controllerAs: 'profileCtrl',
        requiresAuth: true,
        resolve: {
          // A string value resolves to a service
          UserProfilesService: 'UserProfilesService',
          ContactByService: 'ContactByService',
          SettingsService: 'SettingsService',

          appSettings: function(SettingsService) {
            return SettingsService.get();
          },

          profile: function(UserProfilesService, $stateParams) {
            return UserProfilesService.get({
              username: $stateParams.username
            });
          },

          // Contact is loaded only after profile is loaded, because we need the user ID
          contact: function(ContactByService, profile, Authentication) {
            return profile.$promise.then(function() {

              // Own profile, no need to load contact
              if(Authentication.user && Authentication.user._id === profile._id) {
                return false;
              }
              // Load contact
              else {
                return ContactByService.get({
                  userId: profile._id
                });
              }
            });
          }

        }
      }).

      // When attempting to look at profile as non-authenticated user
      state('profile-signup', {
        url: '/profile-signup',
        title: 'Trustroots profile',
        templateUrl: 'modules/users/views/profile/profile-signup.client.view.html',
      }).

      // Auth routes
      state('signup', {
        url: '/signup',
        title: 'Sign up',
        templateUrl: 'modules/users/views/authentication/signup.client.view.html',
        controller: 'SignupController',
        controllerAs: 'signup',
        footerTransparent: false,
        headerHidden: true
      }).
      state('signin', {
        url: '/signin?continue',
        title: 'Sign in',
        templateUrl: 'modules/users/views/authentication/signin.client.view.html',
        controller: 'AuthenticationController',
        controllerAs: 'auth',
        footerTransparent: true,
        headerHidden: true,
        resolve: {
          // A string value resolves to a service
          SettingsService: 'SettingsService',

          appSettings: function(SettingsService) {
            return SettingsService.get();
          }
        }
      }).
      state('confirm-email', {
        url: '/confirm-email/:token?signup',
        title: 'Confirm email',
        templateUrl: 'modules/users/views/authentication/confirm-email.client.view.html',
        footerTransparent: true,
        requiresAuth: false,
        controller: 'ConfirmEmailController',
        controllerAs: 'confirmEmail'
      }).
      state('confirm-email-invalid', {
        url: '/confirm-email-invalid',
        title: 'Confirm email invalid',
        templateUrl: 'modules/users/views/authentication/confirm-email-invalid.client.view.html',
        footerTransparent: true,
        requiresAuth: false
      }).

      // Password reset
      state('forgot', {
        url: '/password/forgot',
        title: 'Reset password',
        templateUrl: 'modules/users/views/password/forgot-password.client.view.html',
        footerTransparent: true,
        controller: 'ForgotPasswordController',
        controllerAs: 'forgotPassword'
      }).
      state('reset-invalid', {
        url: '/password/reset/invalid',
        title: 'Reset password',
        templateUrl: 'modules/users/views/password/reset-password-invalid.client.view.html',
        footerTransparent: true
      }).
      state('reset-success', {
        url: '/password/reset/success',
        title: 'Reset password',
        templateUrl: 'modules/users/views/password/reset-password-success.client.view.html',
        footerTransparent: true
      }).
      state('reset', {
        url: '/password/reset/:token',
        title: 'Reset password',
        templateUrl: 'modules/users/views/password/reset-password.client.view.html',
        footerTransparent: true,
        controller: 'ResetPasswordController',
        controllerAs: 'resetPassword'
      });
  }

})();
