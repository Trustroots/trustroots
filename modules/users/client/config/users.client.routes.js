(function () {
  'use strict';

  angular
    .module('users')
    .config(UsersRoutes);

  /* @ngInject */
  function UsersRoutes($stateProvider) {

    $stateProvider.
      state('invite', {
        url: '/invite',
        templateUrl: '/modules/users/views/invite.client.view.html',
        controller: 'InviteController',
        controllerAs: 'invite',
        requiresAuth: true,
        resolve: {
          // A string value resolves to a service
          SettingsService: 'SettingsService',
          InvitationService: 'InvitationService',

          appSettings: function (SettingsService) {
            return SettingsService.get();
          },

          invitation: function (InvitationService) {
            return InvitationService.get();
          }
        },
        data: {
          pageTitle: 'Invite friends'
        }
      }).

      // Users state routing
      state('welcome', {
        url: '/welcome',
        templateUrl: '/modules/users/views/authentication/welcome.client.view.html',
        requiresAuth: true,
        footerHidden: true,
        data: {
          pageTitle: 'Welcome'
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
      state('profile-edit.locations', {
        url: '/locations',
        templateUrl: '/modules/users/views/profile/profile-edit-locations.client.view.html',
        controller: 'ProfileEditLocationsController',
        controllerAs: 'profileEditLocations',
        requiresAuth: true,
        resolve: {
          // A string value resolves to a service
          SettingsService: 'SettingsService',
          appSettings: function (SettingsService) {
            return SettingsService.get();
          }
        },
        data: {
          pageTitle: 'Edit your locations'
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
          appSettings: function (SettingsService) {
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

          appSettings: function (SettingsService) {
            return SettingsService.get();
          },

          profile: function (UserProfilesService, $stateParams, $q) {
            return UserProfilesService.get({
              username: $stateParams.username
            }).$promise
              .catch(function (e) {

                if (e.status === 404) {
                  // when user was not found, resolving with empty user profile, in order to display the User Not Found error.
                  return { $promise: $q.resolve({ }), $resolved: true };
                }

                throw e;
              });
          },

          // Contact is loaded only after profile is loaded, because we need the profile ID
          contact: function (ContactByService, profile, Authentication) {
            return profile.$promise.then(function (profile) {

              // when user doesn't exist, no need to load contact
              if (!profile._id) {
                return;
              }

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
          },

          // Contacts list is loaded only after profile is loaded, because we need the profile ID
          contacts: function (ContactsListService, profile) {
            return profile.$promise.then(function (profile) {

              // when user doesn't exist, no need to load contacts
              if (!profile._id) {
                return;
              }

              // Load contact
              return ContactsListService.query({
                listUserId: profile._id
              });
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
        templateUrl: '/modules/users/views/profile/profile-view-accommodation.client.view.html',
        requiresAuth: true,
        noScrollingTop: true,
        data: {
          pageTitle: 'Profile accommodation'
        }
      }).
      state('profile.meet', {
        url: '/meet',
        templateUrl: '/modules/offers/views/offer-host-view.client.view.html',
        requiresAuth: true,
        noScrollingTop: true,
        data: {
          pageTitle: 'Profile meet'
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
        // `tribe`: preload tribe in suggested tribes list
        // `code`: prefill invite code
        // `mwr` used by Matre app if invite list is enabled
        url: '/signup?tribe&code&mwr',
        templateUrl: '/modules/users/views/authentication/signup.client.view.html',
        controller: 'SignupController',
        controllerAs: 'signup',
        headerHidden: true,
        footerHidden: true,
        // Don't reload ngView when URL parameters are changed
        reloadOnSearch: false,
        resolve: {
          // A string value resolves to a service
          SettingsService: 'SettingsService',

          appSettings: function (SettingsService) {
            return SettingsService.get();
          }
        },
        data: {
          pageTitle: 'Sign up'
        }
      }).
      state('signin', {
        url: '/signin?continue',
        templateUrl: '/modules/users/views/authentication/signin.client.view.html',
        controller: 'AuthenticationController',
        controllerAs: 'auth',
        headerHidden: true,
        footerHidden: true,
        resolve: {
          // A string value resolves to a service
          SettingsService: 'SettingsService',

          appSettings: function (SettingsService) {
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
        requiresAuth: false,
        data: {
          pageTitle: 'Confirm email invalid'
        }
      }).

      // Password reset
      state('forgot', {
        url: '/password/forgot?userhandle=',
        templateUrl: '/modules/users/views/password/forgot-password.client.view.html',
        controller: 'ForgotPasswordController',
        controllerAs: 'forgotPassword',
        footerHidden: true,
        data: {
          pageTitle: 'Reset password'
        }
      }).
      state('reset-invalid', {
        url: '/password/reset/invalid',
        templateUrl: '/modules/users/views/password/reset-password-invalid.client.view.html',
        footerHidden: true,
        data: {
          pageTitle: 'Reset password'
        }
      }).
      state('reset-success', {
        url: '/password/reset/success',
        templateUrl: '/modules/users/views/password/reset-password-success.client.view.html',
        footerHidden: true,
        data: {
          pageTitle: 'Reset password'
        }
      }).
      state('reset', {
        url: '/password/reset/:token',
        templateUrl: '/modules/users/views/password/reset-password.client.view.html',
        footerHidden: true,
        controller: 'ResetPasswordController',
        controllerAs: 'resetPassword',
        data: {
          pageTitle: 'Reset password'
        }
      }).

      // Profile removal
      state('remove', {
        url: '/remove/:token',
        templateUrl: '/modules/users/views/profile/remove.client.view.html',
        footerHidden: true,
        headerHidden: true,
        requiresAuth: true,
        controller: 'RemoveProfileController',
        controllerAs: 'removeProfile',
        data: {
          pageTitle: 'Remove profile'
        }
      });
  }

}());
