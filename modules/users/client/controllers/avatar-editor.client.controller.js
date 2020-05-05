angular
  .module('users')
  .controller('AvatarEditorController', AvatarEditorController);

/* @ngInject */
function AvatarEditorController(
  $scope,
  $uibModalInstance,
  Upload,
  messageCenterService,
  user,
  appSettings,
) {
  const lastAvatarSource = user.avatarSource;
  let fileAvatar = {};

  // View model
  const vm = this;

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
    $uibModalInstance.dismiss('cancel');
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
          $uibModalInstance.close(vm.user);
        })
        .error(function () {
          messageCenterService.add(
            'danger',
            'Oops! Something went wrong. Try again later.',
          );
          vm.avatarUploading = false;
        });
    } else if (lastAvatarSource !== vm.user.avatarSource) {
      // Close modal due user changed avatar selection (but didn't upload a new file)
      $uibModalInstance.close(vm.user);
    } else {
      // No changes, just dismiss...
      dismissModal();
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

    // Validate file
    if (
      file.type.indexOf('jpeg') === -1 &&
      file.type.indexOf('gif') === -1 &&
      file.type.indexOf('png') === -1
    ) {
      messageCenterService.add(
        'danger',
        'Please give a jpg, gif, or png image.',
      );
    } else if (file.size > appSettings.maxUploadSize) {
      messageCenterService.add(
        'danger',
        'Whoops, your file is too big. Please keep it up to ' +
          bytesToSize(appSettings.maxUploadSize) +
          '. Sorry!',
      );
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
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
  }
}
