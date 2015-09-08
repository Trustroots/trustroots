(function() {
  'use strict';

  angular
    .module('users')
    .controller('AvatarEditorController', AvatarEditorController);

  /* @ngInject */
  function AvatarEditorController($scope, $modalInstance, $timeout, Upload, messageCenterService, user, appSettings) {

    var lastAvatarSource = user.avatarSource,
        fileAvatar = {};

    // View model
    var vm = this;

    // Exposed to the view
    vm.user = user;
    vm.avatarPreview = false;
    vm.dismissModal = dismissModal;
    vm.saveAvatar = saveAvatar;
    vm.fileSelected = fileSelected;

    /**
     * Dismiss modal
     */
    function dismissModal() {
      $modalInstance.dismiss('cancel');
    }

    /**
     * Save avatar changes
     */
    function saveAvatar() {

      // Uploaded new file
      if(vm.user.avatarSource === 'local' && vm.avatarPreview === true) {
        // Upload the new file
        vm.avatarUploading = true;
        vm.upload = Upload.upload({
          url: '/api/users-avatar',
          method: 'POST',
          headers : {
            'Content-Type': (fileAvatar.type !== '' ? fileAvatar.type : 'application/octet-stream')
          },
          file: fileAvatar
        }).progress(function(event) {
          //var uploadProgressPercentage = parseInt(100.0 * event.loaded / event.total);
          //$log.log('progress: ' + uploadProgressPercentage + '% of ' + event.config.file.name);
        }).success(function(data, status, headers, config) {
          vm.avatarUploading = false;
          $modalInstance.close(vm.user);
        }).error(function(data, status, headers, config) {
          messageCenterService.add('danger', 'Oops! Something went wrong. Try again later.', { timeout: appSettings.flashTimeout });
          vm.avatarUploading = false;
          //$modalInstance.dismiss('close');
        });
      }

      // Changed avatar selection (but didn't upload new file)
      else if(lastAvatarSource !== vm.user.avatarSource) {
        $modalInstance.close(vm.user);
      }

      // No changes, just dismiss...
      else {
        dismissModal();
      }
    }

    /**
     * Process preview after file is selected/dropped/received from camera
     */
    function fileSelected($files, $event) {
      // Too early
      if($files && $files.length === 0) {
        return;
      }

      // Accept only one file at once
      var file = $files[0];
      fileAvatar = file;
      vm.user.avatarSource = 'local';

      // Validate file
      if(file.type.indexOf('jpeg') === -1 && file.type.indexOf('gif') === -1 && file.type.indexOf('png') === -1) {
         messageCenterService.add('danger', 'Please give a jpg, gif, or png image.', { timeout: appSettings.flashTimeout });
      }
      else if(file.size > appSettings.maxUploadSize) {
         messageCenterService.add('danger', 'Whoops, your file is too big. Please keep it up to ' + bytesToSize(appSettings.maxUploadSize) + '. Sorry!', { timeout: appSettings.flashTimeout });
      }
      // Upload file
      else {
        vm.avatarUploading = true;

        // Show the local file as a preview
        var fileReader = new FileReader();
        fileReader.readAsDataURL(file);
        fileReader.onloadend = function () {
          vm.avatarPreview = true;
          $scope.$apply(function() {
            vm.previewStyle = fileReader.result;
            vm.avatarUploading = false;
          });
        };
      }
    }

    /**
     * Return bytes in human readable size.
     * E.g. bytesToSize(10000000) => "10 MB"
     *
     * @link http://stackoverflow.com/a/18650828
     */
    function bytesToSize(bytes) {
      var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      if (bytes === 0) return '0 Byte';
      var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
      return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    }

  }

})();
