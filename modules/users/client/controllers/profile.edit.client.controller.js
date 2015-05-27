'use strict';

angular.module('users').controller('EditProfileController', ['$scope', '$modal', '$http', '$stateParams', '$state', 'Languages', 'Users', 'Authentication', 'messageCenterService', 'SettingsFactory', '$upload', '$window',
  function($scope, $modal, $http, $stateParams, $state, Languages, Users, Authentication, messageCenterService, SettingsFactory, $upload, $window) {

    var settings = SettingsFactory.get();

    // Copy user to make a temporary buffer for changes.
    // Prevents changes remaining here when cancelling profile editing.
    $scope.user = new Users(Authentication.user);

    $scope.profile = false;

    /*
     * Language selector
     * Selectors expects language list to be in format:
     *   [{ "key": "fre", "name": "French" }, { "key": "ger", "name": "German" }]
     * but user.languages contains just codes:
     *   ['fre', 'ger']
     *
     * decodeUserLanguages() formats array for Chosen selector
     * encodeUserLanguages() formats array back to user.languages format
     */
    $scope.languages = Languages.get('array');
    $scope.userLanguages = [];
    $scope.decodeUserLanguages = function() {
      var langs_arr = [];
      $scope.user.languages.forEach(function(key) {
        langs_arr[langs_arr.length] = {key: key, name: $window.languages[key]};
      });
      $scope.userLanguages = langs_arr;
    };
    $scope.encodeUserLanguages = function() {
      var langs_arr = [];
      $scope.userLanguages.forEach(function(lang) {
        langs_arr[langs_arr.length] = lang.key;
      });
      $scope.user.languages = langs_arr;
    };

    // Format user language list for Chosen selector
    $scope.decodeUserLanguages();

    // Check if there are additional accounts
    $scope.hasConnectedAdditionalSocialAccounts = function(provider) {
      for (var i in $scope.user.additionalProvidersData) {
        return true;
      }
      return false;
    };

    // Check if provider is already in use with current user
    $scope.isConnectedSocialAccount = function(provider) {
      return $scope.user.provider === provider || ($scope.user.additionalProvidersData && $scope.user.additionalProvidersData[provider]);
    };

    // Remove a user social account
    $scope.removeUserSocialAccount = function(provider) {
      if (confirm('Are you sure you want to disconnect this profile?') === true) {
        $http.delete('/api/users/accounts', {
          params: {
            provider: provider
          }
        }).success(function(response) {
          $scope.user = Authentication.user = response;
        }).error(function(response) {
          messageCenterService.add('danger', response.message || 'Something went wrong. Try again or contact us to disconnect your profile.' , { timeout: 10000 });
        });
      }
    };

    /*
     * Birthday input field
     * Use server 'settings.time' instead of client time
     * @link http://angular-ui.github.io/bootstrap/#/datepicker
     */
    $scope.birthdateFormat = 'yyyy-MM-dd';
    $scope.birthdateOpened = false;
    $scope.birthdateOptions = {
      maxDate: moment(settings.time), //  Set an upper limit for mode.
      minDate: moment(settings.time).subtract(moment.duration(100, 'y')), // Set a lower limit for mode.
      formatYear: 'yyyy', // Format of year in year range
      startingDay: 1, // Starting day of the week from 0-6 (0=Sunday, ..., 6=Saturday)
      yearRange: 30, // Number of years displayed in year selection
      showWeeks: false, // Whether to display week numbers.
    };
    $scope.birthdateOpen = function($event) {
      $event.preventDefault();
      $event.stopPropagation();
      $scope.birthdateOpened = true;
    };

    // Update a user profile
    $scope.updateUserProfile = function(isValid) {
      $scope.encodeUserLanguages();
      if (isValid) {
        $scope.success = $scope.error = null;
        var user = new Users($scope.user);

        // Fixes #66 - <br> appearing to tagline with Firefox
        user.tagline = user.tagline.replace('<br>', '', 'g');
        user.$update(function(response) {
          $scope.success = true;
          Authentication.user = response;
          $state.go('profile-updated', {username: response.username, updated: true});
        }, function(response) {
          $scope.error = response.data.message;
        });
      } else {
        $scope.submitted = true;
      }
    };

    /**
    * Fetch profile
    */
    $scope.findProfile = function() {
      if(!$stateParams.username) {
        $scope.profile = $scope.user;
      }
      else {
        $scope.profile = Users.get({
          username: $stateParams.username
        });
      }
    };

    /**
    * Open avatar -modal
    */
    $scope.avatarModal = function (user, $event) {

      if($event) $event.preventDefault();

      var modalInstance = $modal.open({
        templateUrl: 'modules/users/views/profile/avatar.client.modal.html', //inline at template
        controller: function ($scope, $modalInstance, $upload, Users) {
          $scope.user = user;
          $scope.lastSource = user.avatarSource;

          // Check if provider is already in use with current user
          $scope.isConnectedSocialAccount = function(provider) {
            return $scope.user.provider === provider || ($scope.user.additionalProvidersData && $scope.user.additionalProvidersData[provider]);
          };
          $scope.close = function () {
            $modalInstance.dismiss('close');
          };
          $scope.save = function () {
            if($scope.user.avatarSource === 'local' && $scope.avatarPreview === true) {
              //Let's upload the new file !
              $scope.avatarUploading = true;
              $scope.upload = $upload.upload({
                url: '/api/users/avatar',
                method: 'POST',
                file: $scope.fileAvatar,
              }).success(function(data, status, headers, config) {
                $scope.avatarUploading = false;
                $modalInstance.close($scope.user);
              }).error(function(data, status, headers, config) {
                $scope.avatarUploading = false;
                $modalInstance.dismiss('close');
              });
            }
            else if($scope.lastSource !== $scope.user.avatarSource){
              $modalInstance.close($scope.user);
            }
            else {
              $modalInstance.dismiss('close');
            }
          };
          $scope.avatarPreview = false;
          $scope.fileAvatar = {};
          $scope.fileSelected = function (file) {
            if(angular.isUndefined(file)) {
               messageCenterService.add('danger', 'Something went wrong with this file', { timeout: settings.flashTimeout });
            }
            else if(file.type.indexOf('jpeg') === -1 && file.type.indexOf('gif') === -1 && file.type.indexOf('png') === -1) {
               messageCenterService.add('danger', 'Please use a .jpg, .gif, or .png image', { timeout: settings.flashTimeout });
            }
            else if(file.size > 10000000) {
               messageCenterService.add('danger', 'This file is too big', { timeout: settings.flashTimeout });
            }
            else {
              $scope.avatarUploading = true;
              //Here we show the local file as a preview
              var fileReader = new FileReader();
              fileReader.readAsDataURL(file);
              fileReader.onloadend = function () {
                $scope.avatarPreview = true;
                $scope.$apply(function () {
                  $scope.previewStyle = fileReader.result;
                  $scope.avatarUploading = false;
                });
              };
            }
          };
        }
      });

      //Save the change made to the avatar
      modalInstance.result.then(function (user) {
        $scope.user.updated = new Date();
        if(!$scope.user.avatarUploaded) {
          $scope.user.avatarUploaded = true;
        }
        user = new Users($scope.user);
        user.$update(function(response) {
          $scope.user = response;
        }, function(response) {
          $scope.error = response.data.message;
        });
      });
    };


  }
]);
