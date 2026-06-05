import '@/modules/users/client/users.client.module';
import '@/modules/search/client/search.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('ProfileEditAccountController', function () {
  let ProfileEditAccountController;
  let $httpBackend;
  let messageCenterService;
  let Authentication;

  const user = {
    _id: 'user',
    displayName: 'User',
    emailTemporary: 'foo@foo.com',
  };

  // Load the main application module
  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (
    _$httpBackend_,
    _Authentication_,
    _messageCenterService_,
  ) {
    $httpBackend = _$httpBackend_;
    Authentication = _Authentication_;

    messageCenterService = _messageCenterService_;
    spyOn(messageCenterService, 'add').and.callThrough();
  }));

  afterEach(function () {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  describe('Logged in user', function () {
    beforeEach(function (done) {
      inject(function ($controller, $rootScope) {
        Authentication.user = { ...user };
        ProfileEditAccountController = $controller(
          'ProfileEditAccountController',
          {
            messageCenterService,
            $scope: $rootScope.$new(),
            push: {}, // this ends up trying to load firebaseMessaging service otherwise
          },
        );
        done();
      });
    });

    describe('username validation', function () {
      it('returns user-facing validation errors for invalid usernames', function () {
        expect(
          ProfileEditAccountController.getUsernameValidationError({
            $dirty: false,
            $valid: false,
          }),
        ).toEqual('');
        expect(
          ProfileEditAccountController.getUsernameValidationError({
            $dirty: true,
            $valid: true,
          }),
        ).toEqual('');
        expect(
          ProfileEditAccountController.getUsernameValidationError({
            $dirty: true,
            $error: { required: true },
            $valid: false,
          }),
        ).toEqual('Username is required.');
        expect(
          ProfileEditAccountController.getUsernameValidationError({
            $dirty: true,
            $error: { maxlength: true },
            $valid: false,
          }),
        ).toEqual('Too long, maximum length is 34 characters.');
        expect(
          ProfileEditAccountController.getUsernameValidationError({
            $dirty: true,
            $error: { minlength: true },
            $valid: false,
          }),
        ).toEqual('Too short, minumum length is 3 characters.');
        expect(
          ProfileEditAccountController.getUsernameValidationError({
            $dirty: true,
            $error: { pattern: true },
            $valid: false,
          }),
        ).toEqual('Invalid username.');
        expect(
          ProfileEditAccountController.getUsernameValidationError({
            $dirty: true,
            $error: { username: true },
            $valid: false,
          }),
        ).toEqual('This username is already in use or invalid.');
        expect(
          ProfileEditAccountController.getUsernameValidationError({
            $dirty: true,
            $error: {},
            $valid: false,
          }),
        ).toEqual('Invalid username.');
      });
    });

    describe('change username', function () {
      it('updates username without sending a changed email', function () {
        ProfileEditAccountController.user.username = 'new-username';
        ProfileEditAccountController.user.email = 'changed@example.com';
        const expectedPutData = {
          _id: 'user',
          displayName: 'User',
          emailTemporary: 'foo@foo.com',
          username: 'new-username',
        };
        const updatedUser = {
          _id: 'user',
          displayName: 'User',
          username: 'new-username',
        };

        $httpBackend
          .expect('PUT', '/api/users', expectedPutData)
          .respond(200, updatedUser);
        ProfileEditAccountController.updateUsername();
        $httpBackend.flush();

        expect(messageCenterService.add).toHaveBeenCalledWith(
          'success',
          'Username updated.',
        );
        expect(Authentication.user).toMatchObject(updatedUser);
      });

      it('shows the username update error returned by the API', function () {
        ProfileEditAccountController.user.username = 'taken-username';

        $httpBackend.expect('PUT', '/api/users').respond(400, {
          message: 'Username is already taken.',
        });
        ProfileEditAccountController.updateUsername();
        $httpBackend.flush();

        expect(ProfileEditAccountController.usernameError).toEqual(
          'Username is already taken.',
        );
      });
    });

    describe('change email address', function () {
      it('can update email address', function () {
        ProfileEditAccountController.user.emailTemporary = 'new@email.com';
        const expectedPutData = {
          _id: 'user',
          displayName: 'User',
          emailTemporary: 'new@email.com',
        };
        $httpBackend.expect('PUT', '/api/users', expectedPutData).respond(200);
        ProfileEditAccountController.updateUserEmail();
        $httpBackend.flush();
        expect(messageCenterService.add).toHaveBeenCalledWith(
          'success',
          'Check your email for further instructions.',
        );
      });

      it('can show an error message during failure', function () {
        ProfileEditAccountController.user.emailTemporary = 'new@email.com';
        $httpBackend.expect('PUT', '/api/users').respond(500);
        ProfileEditAccountController.updateUserEmail();
        $httpBackend.flush();
        expect(ProfileEditAccountController.emailError).toEqual(
          'Something went wrong.',
        );
      });

      it('can show a custom error message during failure', function () {
        ProfileEditAccountController.user.emailTemporary = 'new@email.com';
        $httpBackend
          .expect('PUT', '/api/users')
          .respond(400, { message: 'custom error' });
        ProfileEditAccountController.updateUserEmail();
        $httpBackend.flush();
        expect(ProfileEditAccountController.emailError).toEqual('custom error');
      });
    });

    describe('change password', function () {
      it('changes password and clears the form fields', function () {
        ProfileEditAccountController.currentPassword = 'old-password';
        ProfileEditAccountController.newPassword = 'new-password';
        ProfileEditAccountController.verifyPassword = 'new-password';
        const updatedUser = {
          _id: 'user',
          displayName: 'User',
          passwordUpdated: true,
        };

        $httpBackend
          .expect('POST', '/api/users/password', {
            currentPassword: 'old-password',
            newPassword: 'new-password',
            verifyPassword: 'new-password',
          })
          .respond(200, { user: updatedUser });
        ProfileEditAccountController.changeUserPassword();
        expect(ProfileEditAccountController.changeUserPasswordLoading).toEqual(
          true,
        );
        $httpBackend.flush();

        expect(ProfileEditAccountController.currentPassword).toEqual('');
        expect(ProfileEditAccountController.newPassword).toEqual('');
        expect(ProfileEditAccountController.verifyPassword).toEqual('');
        expect(ProfileEditAccountController.changeUserPasswordLoading).toEqual(
          false,
        );
        expect(Authentication.user).toEqual(updatedUser);
        expect(messageCenterService.add).toHaveBeenCalledWith(
          'success',
          'Your password is now changed. Have a nice day!',
        );
      });

      it('shows the password error returned by the API', function () {
        $httpBackend.expect('POST', '/api/users/password').respond(400, {
          message: 'Current password is incorrect.',
        });
        ProfileEditAccountController.changeUserPassword();
        $httpBackend.flush();

        expect(ProfileEditAccountController.changeUserPasswordLoading).toEqual(
          false,
        );
        expect(messageCenterService.add).toHaveBeenCalledWith(
          'danger',
          'Current password is incorrect.',
          { timeout: 10000 },
        );
      });
    });

    describe('remove profile', function () {
      it('does not initialize removal before confirmation', function () {
        ProfileEditAccountController.removeProfile();

        expect(ProfileEditAccountController.removeProfileLoading).toEqual(
          false,
        );
      });

      it('initializes profile removal once confirmed', function () {
        ProfileEditAccountController.removeProfileConfirm = true;

        $httpBackend.expect('DELETE', '/api/users').respond(200, {
          message: 'Removal initialized.',
        });
        ProfileEditAccountController.removeProfile();
        expect(ProfileEditAccountController.removeProfileLoading).toEqual(true);
        $httpBackend.flush();

        expect(ProfileEditAccountController.removeProfileInitialized).toEqual(
          'Removal initialized.',
        );
      });

      it('shows an error when profile removal cannot be initialized', function () {
        ProfileEditAccountController.removeProfileConfirm = true;

        $httpBackend.expect('DELETE', '/api/users').respond(500);
        ProfileEditAccountController.removeProfile();
        $httpBackend.flush();

        expect(ProfileEditAccountController.removeProfileLoading).toEqual(
          false,
        );
        expect(messageCenterService.add).toHaveBeenCalledWith(
          'danger',
          'Something went wrong while initializing profile removal, try again.',
          { timeout: 10000 },
        );
      });
    });

    describe('resend email confirmation', function () {
      it('can resend email', function () {
        $httpBackend
          .expect('POST', '/api/auth/resend-confirmation')
          .respond(200);
        ProfileEditAccountController.resendUserEmailConfirm();
        $httpBackend.flush();
        expect(messageCenterService.add).toHaveBeenCalledWith(
          'success',
          'Confirmation email resent.',
        );
      });

      it('can show an error message during failure', function () {
        $httpBackend
          .expect('POST', '/api/auth/resend-confirmation')
          .respond(500);
        ProfileEditAccountController.resendUserEmailConfirm();
        $httpBackend.flush();
        expect(messageCenterService.add).toHaveBeenCalledWith(
          'danger',
          'Error: Something went wrong.',
        );
      });

      it('can show an custom error message during failure', function () {
        $httpBackend
          .expect('POST', '/api/auth/resend-confirmation')
          .respond(400, {
            message: 'my custom error',
          });
        ProfileEditAccountController.resendUserEmailConfirm();
        $httpBackend.flush();
        expect(messageCenterService.add).toHaveBeenCalledWith(
          'danger',
          'Error: my custom error',
        );
      });
    });
  });
});
