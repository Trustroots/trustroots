import '@/modules/users/client/users.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('AvatarEditorController', function () {
  let $controller;
  let $rootScope;
  let $scope;
  let messageCenterService;
  let Upload;
  let $uibModalInstance;
  let appSettings;
  let originalFileReader;
  let uploadSuccessCallback;
  let uploadErrorCallback;

  class MockFileReader {
    constructor() {
      MockFileReader.instances.push(this);
      this.result = 'data:image/png;base64,avatar-preview';
    }

    readAsDataURL(file) {
      this.file = file;
    }
  }

  MockFileReader.instances = [];

  beforeEach(function () {
    originalFileReader = global.FileReader;
    global.FileReader = MockFileReader;
    MockFileReader.instances = [];
  });

  beforeEach(function () {
    messageCenterService = {
      add: jasmine.createSpy('messageCenterService.add'),
    };

    appSettings = {
      maxUploadSize: 1024 * 1024,
    };

    Upload = {
      upload: jasmine.createSpy('Upload.upload').and.callFake(function () {
        return {
          success(callback) {
            uploadSuccessCallback = callback;
            return this;
          },
          error(callback) {
            uploadErrorCallback = callback;
            return this;
          },
        };
      }),
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('Upload', Upload);
      $provide.value('messageCenterService', messageCenterService);
      $provide.value('appSettings', appSettings);
    });
  });

  beforeEach(inject(function (_$controller_, _$rootScope_) {
    $controller = _$controller_;
    $rootScope = _$rootScope_;
  }));

  afterEach(function () {
    global.FileReader = originalFileReader;
  });

  function createController(userOverrides = {}) {
    const user = {
      _id: 'user-1',
      avatarSource: 'none',
      ...userOverrides,
    };

    $scope = $rootScope.$new();
    $uibModalInstance = {
      close: jasmine.createSpy('close'),
      dismiss: jasmine.createSpy('dismiss'),
    };

    return $controller('AvatarEditorController as vm', {
      $scope,
      $uibModalInstance,
      messageCenterService,
      user,
      appSettings,
      Upload,
    });
  }

  function validImageFile(overrides = {}) {
    return {
      name: 'avatar.png',
      size: 1024,
      type: 'image/png',
      ...overrides,
    };
  }

  it('dismisses modal when no avatar changes are made', function () {
    const controller = createController();
    controller.saveAvatar();

    expect($uibModalInstance.dismiss).toHaveBeenCalledWith('cancel');
  });

  it('closes modal when user changes avatar source only', function () {
    const controller = createController();
    controller.user.avatarSource = 'facebook';
    controller.saveAvatar();

    expect($uibModalInstance.close).toHaveBeenCalledWith(controller.user);
  });

  it('ignores empty file selections', function () {
    const controller = createController();
    controller.fileSelected([]);

    expect(Upload.upload).not.toHaveBeenCalled();
    expect(controller.avatarPreview).toBe(false);
    expect(messageCenterService.add).not.toHaveBeenCalled();
  });

  it('rejects unsupported file types', function () {
    const controller = createController();
    controller.fileSelected([validImageFile({ type: 'text/plain' })]);

    expect(Upload.upload).not.toHaveBeenCalled();
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Please give a jpg, gif, or png image.',
    );
  });

  it('rejects files that exceed upload limits', function () {
    const controller = createController();
    controller.fileSelected([validImageFile({ size: 2 * 1024 * 1024 })]);

    expect(Upload.upload).not.toHaveBeenCalled();
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Whoops, your file is too big. Please keep it up to 1 MB. Sorry!',
    );
  });

  it('renders zero-byte max upload sizes in oversized file warnings', function () {
    appSettings.maxUploadSize = 0;
    const controller = createController();

    controller.fileSelected([validImageFile({ size: 1 })]);

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Whoops, your file is too big. Please keep it up to 0 Byte. Sorry!',
    );
  });

  it('previews valid image before upload', function () {
    const controller = createController();
    const file = validImageFile();

    controller.fileSelected([file]);
    MockFileReader.instances[0].onloadend();

    expect(controller.avatarPreview).toBe(true);
    expect(controller.previewStyle).toBe(
      'data:image/png;base64,avatar-preview',
    );
    expect(controller.avatarUploading).toBe(false);
    expect(controller.user.avatarSource).toBe('local');
  });

  it('uploads and closes modal for valid local changes', function () {
    const controller = createController();
    const file = validImageFile();

    controller.fileSelected([file]);
    MockFileReader.instances[0].onloadend();
    controller.saveAvatar();

    expect(Upload.upload).toHaveBeenCalledWith({
      url: '/api/users-avatar',
      method: 'POST',
      headers: {
        'Content-Type': file.type,
      },
      data: {
        avatar: file,
      },
    });

    expect(controller.avatarUploading).toBe(true);
    uploadSuccessCallback();
    expect(controller.avatarUploading).toBe(false);
    expect($uibModalInstance.close).toHaveBeenCalledWith(controller.user);
  });

  it('uses octet-stream content type when selected file type is cleared before upload', function () {
    const controller = createController();
    const file = validImageFile();

    controller.fileSelected([file]);
    MockFileReader.instances[0].onloadend();
    file.type = '';
    controller.saveAvatar();

    expect(Upload.upload).toHaveBeenCalledWith(
      jasmine.objectContaining({
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      }),
    );
  });

  it('shows warning when upload fails', function () {
    const controller = createController();
    const file = validImageFile();

    controller.fileSelected([file]);
    MockFileReader.instances[0].onloadend();
    controller.saveAvatar();

    uploadErrorCallback();
    expect(controller.avatarUploading).toBe(false);
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Oops! Something went wrong. Try again later.',
    );
  });
});
