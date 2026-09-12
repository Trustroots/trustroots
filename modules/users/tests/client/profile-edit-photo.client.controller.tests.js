import '@/modules/users/client/users.client.module';
import '@/modules/search/client/search.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('ProfileEditPhotoController', function () {
  let $controller;
  let $httpBackend;
  let $rootScope;
  let $scope;
  let Authentication;
  let ProfileEditPhotoController;
  let Upload;
  let appSettings;
  let messageCenterService;
  let uploadErrorCallback;
  let uploadSuccessCallback;
  let windowListeners;
  let originalFileReader;

  const user = {
    _id: 'user',
    avatarSource: 'none',
    displayName: 'User',
  };

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
    document.body.innerHTML = '<div id="profile-edit-avatar-drop"></div>';
    windowListeners = {};
    uploadErrorCallback = null;
    uploadSuccessCallback = null;
    MockFileReader.instances = [];

    originalFileReader = global.FileReader;
    global.FileReader = MockFileReader;

    Upload = {
      upload: jasmine.createSpy('upload').and.returnValue({
        success(callback) {
          uploadSuccessCallback = callback;
          return this;
        },
        error(callback) {
          uploadErrorCallback = callback;
          return this;
        },
      }),
    };

    appSettings = {
      maxUploadSize: 1024 * 1024,
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('Upload', Upload);
      $provide.value('appSettings', appSettings);
    });
  });

  beforeEach(inject(function (
    _$controller_,
    _$httpBackend_,
    _$rootScope_,
    _Authentication_,
    _messageCenterService_,
  ) {
    $controller = _$controller_;
    $httpBackend = _$httpBackend_;
    $rootScope = _$rootScope_;
    Authentication = _Authentication_;
    messageCenterService = _messageCenterService_;

    spyOn(messageCenterService, 'add').and.callThrough();
  }));

  afterEach(function () {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
    document.body.innerHTML = '';
    global.FileReader = originalFileReader;
  });

  function createController() {
    const $window = {
      addEventListener: jasmine
        .createSpy('addEventListener')
        .and.callFake(function (eventName, callback) {
          windowListeners[eventName] = callback;
        }),
    };

    Authentication.user = { ...user };
    $scope = $rootScope.$new();
    spyOn($scope, '$emit').and.callThrough();

    ProfileEditPhotoController = $controller('ProfileEditPhotoController', {
      $scope,
      $window,
      messageCenterService,
    });
  }

  function imageFile(overrides = {}) {
    return {
      name: 'avatar.png',
      size: 1000,
      type: 'image/png',
      ...overrides,
    };
  }

  function selectValidImage(overrides = {}) {
    const file = imageFile(overrides);
    ProfileEditPhotoController.fileSelected([file]);
    MockFileReader.instances[0].onloadend();
    return file;
  }

  beforeEach(function () {
    createController();
  });

  it('toggles the dropzone while files are dragged over the page', function () {
    windowListeners.dragenter();
    expect(ProfileEditPhotoController.showDropzone).toBe(true);

    windowListeners.drop();
    expect(ProfileEditPhotoController.showDropzone).toBe(false);

    windowListeners.dragenter();
    angular
      .element('#profile-edit-avatar-drop')[0]
      .dispatchEvent(new Event('dragleave'));
    expect(ProfileEditPhotoController.showDropzone).toBe(false);
  });

  it('ignores an empty file selection', function () {
    ProfileEditPhotoController.fileSelected([]);

    expect(Upload.upload).not.toHaveBeenCalled();
    expect(ProfileEditPhotoController.avatarPreview).toBe(false);
    expect(messageCenterService.add).not.toHaveBeenCalled();
  });

  it('ignores a missing file selection', function () {
    ProfileEditPhotoController.fileSelected();

    expect(Upload.upload).not.toHaveBeenCalled();
    expect(ProfileEditPhotoController.avatarPreview).toBe(false);
    expect(messageCenterService.add).not.toHaveBeenCalled();
  });

  it('shows a validation message for unsupported file types', function () {
    ProfileEditPhotoController.fileSelected([
      imageFile({ name: 'avatar.txt', type: 'text/plain' }),
    ]);

    expect(Upload.upload).not.toHaveBeenCalled();
    expect(ProfileEditPhotoController.user.avatarSource).toBe('local');
    expect(ProfileEditPhotoController.user.avatarUploaded).toBe(true);
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Please give a jpg, gif, or png image.',
    );
  });

  it('shows a validation message when file metadata is missing', function () {
    ProfileEditPhotoController.fileSelected([
      imageFile({ name: undefined, type: undefined }),
    ]);

    expect(Upload.upload).not.toHaveBeenCalled();
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Please give a jpg, gif, or png image.',
    );
  });

  it('accepts image files when the browser omits the MIME type', function () {
    const file = selectValidImage({ name: 'avatar.jpg', type: '' });

    expect(ProfileEditPhotoController.avatarPreview).toBe(true);
    expect(Upload.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          avatar: file,
        },
      }),
    );
  });

  it('shows a validation message when the selected image is too large', function () {
    ProfileEditPhotoController.fileSelected([imageFile({ size: 1024 * 1025 })]);

    expect(Upload.upload).not.toHaveBeenCalled();
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Whoops, your file is too big. Please keep it up to 1 MB.',
    );
  });

  it('previews, uploads, and saves a valid image', function () {
    const updatedUser = {
      _id: 'user',
      avatarSource: 'local',
      displayName: 'Updated User',
    };

    const file = selectValidImage();

    expect(ProfileEditPhotoController.avatarPreview).toBe(true);
    expect(ProfileEditPhotoController.previewStyle).toBe(
      'data:image/png;base64,avatar-preview',
    );
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

    $httpBackend.expectPUT('/api/users').respond(200, updatedUser);
    uploadSuccessCallback();
    $httpBackend.flush();

    expect(ProfileEditPhotoController.avatarUploading).toBe(false);
    expect(Authentication.user).toMatchObject(updatedUser);
    expect($scope.$emit).toHaveBeenCalledWith(
      'userUpdated',
      expect.objectContaining(updatedUser),
    );
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'success',
      'Profile photo updated.',
    );
  });

  it('uses octet-stream content type when the selected image type is cleared before upload', function () {
    const file = imageFile();

    ProfileEditPhotoController.fileSelected([file]);
    file.type = '';
    MockFileReader.instances[0].onloadend();

    expect(Upload.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        data: {
          avatar: file,
        },
      }),
    );
  });

  it('does not upload when avatar source changes before the preview is ready', function () {
    const file = imageFile();

    ProfileEditPhotoController.fileSelected([file]);
    Upload.upload.calls.reset();
    ProfileEditPhotoController.user.avatarSource = 'none';
    MockFileReader.instances[0].onloadend();

    expect(ProfileEditPhotoController.avatarPreview).toBe(true);
    expect(Upload.upload).not.toHaveBeenCalled();
  });

  it('shows the processing error returned by the avatar upload endpoint', function () {
    selectValidImage();

    uploadErrorCallback(null, 422);

    expect(ProfileEditPhotoController.avatarUploading).toBe(false);
    expect(ProfileEditPhotoController.avatarPreview).toBe(false);
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Sorry, we could not process this file.',
    );
  });

  it('shows the file-size error returned by the avatar upload endpoint', function () {
    selectValidImage();

    uploadErrorCallback(null, 413);

    expect(ProfileEditPhotoController.avatarUploading).toBe(false);
    expect(ProfileEditPhotoController.avatarPreview).toBe(false);
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Whoops, your file is too big. Please keep it up to 1 MB.',
    );
  });

  it('shows the media-type error returned by the avatar upload endpoint', function () {
    selectValidImage();

    uploadErrorCallback(null, 415);

    expect(ProfileEditPhotoController.avatarUploading).toBe(false);
    expect(ProfileEditPhotoController.avatarPreview).toBe(false);
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Sorry, we do not support this type of file.',
    );
  });

  it('uses the payload status when the upload error callback omits the HTTP status', function () {
    selectValidImage();

    uploadErrorCallback({ status: 415 }, null);

    expect(ProfileEditPhotoController.avatarUploading).toBe(false);
    expect(ProfileEditPhotoController.avatarPreview).toBe(false);
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Sorry, we do not support this type of file.',
    );
  });

  it('falls back to a generic error when neither callback arg has a numeric status', function () {
    selectValidImage();

    uploadErrorCallback(null, 'invalid');

    expect(ProfileEditPhotoController.avatarUploading).toBe(false);
    expect(ProfileEditPhotoController.avatarPreview).toBe(false);
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Oops! Something went wrong. Try again later.',
    );
  });

  it('shows the generic avatar upload error for unknown upload failures', function () {
    selectValidImage();

    uploadErrorCallback(null, 500);

    expect(ProfileEditPhotoController.avatarUploading).toBe(false);
    expect(ProfileEditPhotoController.avatarPreview).toBe(false);
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Oops! Something went wrong. Try again later.',
    );
  });

  it('formats zero-byte upload limits in upload error messages', function () {
    selectValidImage();
    appSettings.maxUploadSize = 0;

    uploadErrorCallback(null, 413);

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Whoops, your file is too big. Please keep it up to 0 Byte.',
    );
  });

  it('shows a generic profile update message when the API omits an error message', function () {
    selectValidImage();

    $httpBackend.expectPUT('/api/users').respond(500, {});
    uploadSuccessCallback();
    $httpBackend.flush();

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Oops! Something went wrong.',
    );
  });
});
