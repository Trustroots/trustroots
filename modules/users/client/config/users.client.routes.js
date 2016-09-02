(function () {
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
        templateUrl: '/modules/users/views/authentication/welcome.client.view.html',
        requiresAuth: true,
        footerTransparent: true,
        data: {
          pageTitle: 'Welcome'
        }
      }).

      // This route was deprecated Mar 2016
      // Redirects to `profile-edit.account`
      state('profile-settings', {
        url: '/profile/settings',
        requiresAuth: true,
        controller:
          /* @ngInject */
          function($state) {
            $state.go('profile-edit.account');
          },
        controllerAs: 'profileSettings',
        data: {
          pageTitle: 'Account'
        }
      }).

      state('profile-edit', {
        url: '/profile/edit',
        templateUrl: '/modules/users/views/profile/profile-edit.client.view.html',
        abstract: true,
        controller: 'ProfileEditController',
        controllerAs: 'profileEdit'
      }).
        state('profile-edit.about', {
          url: '',
          templateUrl: '/modules/users/views/profile/profile-edit-about.client.view.html',
          controller: 'ProfileEditAboutController',
          controllerAs: 'profileEditAbout',
          requiresAuth: true,
          data: {
            pageTitle: 'Edit profile'
          }
        }).
        state('profile-edit.photo', {
          url: '/photo',
          templateUrl: '/modules/users/views/profile/profile-edit-photo.client.view.html',
          controller: 'ProfileEditPhotoController',
          controllerAs: 'profileEditPhoto',
          requiresAuth: true,
          resolve: {
            // A string value resolves to a service
            SettingsService: 'SettingsService',
            appSettings: function(SettingsService) {
              return SettingsService.get();
            }
          },
          data: {
            pageTitle: 'Edit profile photo'
          }
        }).
        state('profile-edit.networks', {
          url: '/networks',
          templateUrl: '/modules/users/views/profile/profile-edit-networks.client.view.html',
          controller: 'ProfileEditNetworksController',
          controllerAs: 'profileEditNetworks',
          requiresAuth: true,
          data: {
            pageTitle: 'Edit Profile networks'
          }
        }).
        state('profile-edit.account', {
          url: '/account',
          templateUrl: '/modules/users/views/profile/profile-edit-account.client.view.html',
          controller: 'ProfileEditAccountController',
          controllerAs: 'profileEditAccount',
          requiresAuth: true,
          data: {
            pageTitle: 'Account'
          }
        }).

      state('profile', {
        url: '/profile/:username',
        templateUrl: '/modules/users/views/profile/profile-view.client.view.html',
        controller: 'ProfileController',
        controllerAs: 'profileCtrl',
        requiresAuth: true,
        abstract: true,
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

          // Contact is loaded only after profile is loaded, because we need the profile ID
          contact: function(ContactByService, profile, Authentication) {
            return profile.$promise.then(function(profile) {
              if (Authentication.user && Authentication.user._id === profile._id) {
                // No profile found or looking at own profile: no need to load contact
                return;
              } else {
                // Load contact
                return ContactByService.get({
                  userId: profile._id
                });
              }
            });
          }

        },
        data: {
          pageTitle: 'Profile'
        }
      }).
        state('profile.about', {
          url: '',
          templateUrl: '/modules/users/views/profile/profile-view-about.client.view.html',
          requiresAuth: true,
          noScrollingTop: true,
          data: {
            pageTitle: 'Profile'
          }
        }).
        state('profile.accommodation', {
          url: '/accommodation',
          templateUrl: '/modules/offers/views/offers-view.client.view.html',
          requiresAuth: true,
          noScrollingTop: true,
          data: {
            pageTitle: 'Profile accommodation'
          }
        }).
        state('profile.overview', {
          url: '/overview',
          templateUrl: '/modules/users/views/profile/profile-view-basics.client.view.html',
          requiresAuth: true,
          noScrollingTop: true,
          data: {
            pageTitle: 'Profile overview'
          }
        }).
        state('profile.contacts', {
          url: '/contacts',
          templateUrl: '/modules/contacts/views/list-contacts.client.view.html',
          requiresAuth: true,
          noScrollingTop: true,
          data: {
            pageTitle: 'Profile contacts'
          }
        }).
        state('profile.tribes', {
          url: '/tribes',
          templateUrl: '/modules/users/views/profile/profile-view-tribes.client.view.html',
          requiresAuth: true,
          noScrollingTop: true,
          data: {
            pageTitle: 'Profile tribes'
          }
        }).

      // When attempting to look at profile as non-authenticated user
      state('profile-signup', {
        url: '/profile-signup',
        templateUrl: '/modules/users/views/profile/profile-signup.client.view.html',
        data: {
          pageTitle: 'Trustroots profile'
        }
      }).

      // Auth routes
      state('signup', {
        url: '/signup?tribe',
        templateUrl: '/modules/users/views/authentication/signup.client.view.html',
        controller: 'SignupController',
        controllerAs: 'signup',
        footerTransparent: false,
        headerHidden: true,
        data: {
          pageTitle: 'Sign up'
        }
      }).
      state('signin', {
        url: '/signin?continue',
        templateUrl: '/modules/users/views/authentication/signin.client.view.html',
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
        },
        data: {
          pageTitle: 'Sign in'
        }
      }).
      state('confirm-email', {
        url: '/confirm-email/:token?signup',
        templateUrl: '/modules/users/views/authentication/confirm-email.client.view.html',
        footerTransparent: true,
        requiresAuth: false,
        controller: 'ConfirmEmailController',
        controllerAs: 'confirmEmail',
        data: {
          pageTitle: 'Confirm email'
        }
      }).
      state('confirm-email-invalid', {
        url: '/confirm-email-invalid',
        templateUrl: '/modules/users/views/authentication/confirm-email-invalid.client.view.html',
        footerTransparent: true,
        requiresAuth: false,
        data: {
          pageTitle: 'Confirm email invalid'
        }
      }).

      // Password reset
      state('forgot', {
        url: '/password/forgot',
        templateUrl: '/modules/users/views/password/forgot-password.client.view.html',
        footerTransparent: true,
        controller: 'ForgotPasswordController',
        controllerAs: 'forgotPassword',
        data: {
          pageTitle: 'Reset password'
        }
      }).
      state('reset-invalid', {
        url: '/password/reset/invalid',
        templateUrl: '/modules/users/views/password/reset-password-invalid.client.view.html',
        footerTransparent: true,
        data: {
          pageTitle: 'Reset password'
        }
      }).
      state('reset-success', {
        url: '/password/reset/success',
        templateUrl: '/modules/users/views/password/reset-password-success.client.view.html',
        footerTransparent: true,
        data: {
          pageTitle: 'Reset password'
        }
      }).
      state('reset', {
        url: '/password/reset/:token',
        templateUrl: '/modules/users/views/password/reset-password.client.view.html',
        footerTransparent: true,
        controller: 'ResetPasswordController',
        controllerAs: 'resetPassword',
        data: {
          pageTitle: 'Reset password'
        }
      });
  }

}());
