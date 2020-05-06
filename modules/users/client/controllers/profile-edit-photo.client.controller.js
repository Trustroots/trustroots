angular
  .module('users')
  .controller('ProfileEditPhotoController', ProfileEditPhotoController);

/* @ngInject */
function ProfileEditPhotoController(
  $scope,
  $window,
  Users,
  Authentication,
  messageCenterService,
  Upload,
  appSettings,
) {
  // ViewModel
  const vm = this;

  // Copy user to make a temporary buffer for changes.
  // Prevents changes remaining here when cancelling profile editing.
  vm.user = new Users(Authentication.user);

  let fileAvatar = {};

  // Exposed
  vm.showDropzone = false;
  vm.avatarPreview = false;
  vm.fileSelected = fileSelected;
  vm.updateUserProfile = updateUserProfile;

  // Initialize controller
  activate();

  function activate() {
    $window.addEventListener('dragenter', function () {
      showDropZone();
    });
    $window.addEventListener('drop', function () {
      hideDropZone();
    });
    angular
      .element('#profile-edit-avatar-drop')[0]
      .addEventListener('dragleave', function () {
        hideDropZone();
      });
  }

  function showDropZone() {
    $scope.$apply(function () {
      vm.showDropzone = true;
    });
  }
  function hideDropZone() {
    $scope.$apply(function () {
      vm.showDropzone = false;
    });
  }

  /**
   * Save avatar changes
   */
  function saveAvatar() {
    // Uploaded new file
    if (vm.user.avatarSource === 'local' && vm.avatarPreview === true) {
      // Upload the new file
      vm.avatarUploading = true;
      vm.upload = Upload.upload({
        url: '/api/users-avatar',
        method: 'POST',
        headers: {
          'Content-Type':
            fileAvatar.type !== ''
              ? fileAvatar.type
              : 'application/octet-stream',
        },
        data: {
          avatar: fileAvatar,
        },
      })
        .success(function () {
          vm.avatarUploading = false;
          updateUserProfile();
        })
        .error(function (data, status) {
          // Default error
          let saveAvatarErr = 'Oops! Something went wrong. Try again later.';

          if (status === 422) {
            // Could not process file
            saveAvatarErr = 'Sorry, we could not process this file.';
          } else if (status === 413) {
            // File too large
            saveAvatarErr =
              'Whoops, your file is too big. Please keep it up to ' +
              bytesToSize(appSettings.maxUploadSize) +
              '.';
          } else if (status === 415) {
            // Unsupported media type
            saveAvatarErr = 'Sorry, we do not support this type of file.';
          }

          messageCenterService.add('danger', saveAvatarErr);
          vm.avatarUploading = false;
          vm.avatarPreview = false;
        });
    }
  }

  /**
   * Process preview after file is selected via fileinput / dropped to window / received from camera
   */
  function fileSelected($files) {
    // Too early
    if ($files && $files.length === 0) {
      return;
    }

    // Accept only one file at once
    const file = $files[0];
    fileAvatar = file;
    vm.user.avatarSource = 'local';
    vm.user.avatarUploaded = true;

    // Validate filetype
    if (
      file.type.indexOf('jpeg') === -1 &&
      file.type.indexOf('gif') === -1 &&
      file.type.indexOf('png') === -1
    ) {
      messageCenterService.add(
        'danger',
        'Please give a jpg, gif, or png image.',
      );
      // Validate filesize
    } else if (file.size > appSettings.maxUploadSize) {
      messageCenterService.add(
        'danger',
        'Whoops, your file is too big. Please keep it up to ' +
          bytesToSize(appSettings.maxUploadSize) +
          '.',
      );
      // All good, uploading file...
    } else {
      vm.avatarUploading = true;

      // Show the local file as a preview
      const fileReader = new FileReader();
      fileReader.readAsDataURL(file);
      fileReader.onloadend = function () {
        vm.avatarPreview = true;
        $scope.$apply(function () {
          vm.previewStyle = fileReader.result;
          vm.avatarUploading = false;
          saveAvatar();
        });
      };
    }
  }

  /**
   * Save profile
   */
  function updateUserProfile() {
    // Note that this won't end up to the DB as is, it's just used as a cache-buster for new avatar
    vm.user.updated = new Date();

    vm.user.$update(
      function (updatedUser) {
        vm.user = Authentication.user = updatedUser;
        // Notify AppController
        $scope.$emit('userUpdated', updatedUser);
        messageCenterService.add('success', 'Profile photo updated.');
      },
      function (err) {
        messageCenterService.add(
          'danger',
          err.data.message || 'Oops! Something went wrong.',
        );
      },
    );
  }

  /**
   * Return bytes in human readable size.
   * E.g. bytesToSize(10000000) => "10 MB"
   *
   * @link http://stackoverflow.com/a/18650828
   */
  function bytesToSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
  }
}
