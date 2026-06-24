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
            $valid: false,
          }),
        ).toEqual('Invalid username.');
        expect(
          ProfileEditAccountController.getUsernameValidationError({
            $dirty: true,
            $error: {},
            $usernameValue: '',
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
        ).toEqual(
          'Use 3-34 lowercase letters and numbers, including at least one letter.',
        );
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

      it('detects a legacy current username', function () {
        Authentication.user.username = 'legacy-name';
        inject(function ($controller, $rootScope) {
          ProfileEditAccountController = $controller(
            'ProfileEditAccountController',
            {
              messageCenterService,
              $scope: $rootScope.$new(),
              push: {},
            },
          );
        });

        expect(ProfileEditAccountController.hasLegacyUsername()).toEqual(true);
      });

      it('does not treat a current lowercase alphanumeric username as legacy', function () {
        Authentication.user.username = 'currentname1';
        inject(function ($controller, $rootScope) {
          ProfileEditAccountController = $controller(
            'ProfileEditAccountController',
            {
              messageCenterService,
              $scope: $rootScope.$new(),
              push: {},
            },
          );
        });

        expect(ProfileEditAccountController.hasLegacyUsername()).toEqual(false);
      });
    });

    describe('change username', function () {
      it('updates username without sending a changed email', function () {
        ProfileEditAccountController.user.username = 'newusername';
        ProfileEditAccountController.user.email = 'changed@example.com';
        const expectedPutData = {
          _id: 'user',
          displayName: 'User',
          emailTemporary: 'foo@foo.com',
          username: 'newusername',
        };
        const updatedUser = {
          _id: 'user',
          displayName: 'User',
          username: 'newusername',
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
        ProfileEditAccountController.user.username = 'takenusername';

        $httpBackend.expect('PUT', '/api/users').respond(400, {
          message: 'Username is already taken.',
        });
        ProfileEditAccountController.updateUsername();
        $httpBackend.flush();

        expect(ProfileEditAccountController.usernameError).toEqual(
          'Username is already taken.',
        );
      });

      it('falls back to a generic username update error', function () {
        ProfileEditAccountController.user.username = 'newusername';

        $httpBackend.expect('PUT', '/api/users').respond(500);
        ProfileEditAccountController.updateUsername();
        $httpBackend.flush();

        expect(ProfileEditAccountController.usernameError).toEqual(
          'Something went wrong',
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
        expect(Authentication.user).toMatchObject(updatedUser);
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

      it('falls back to the generic password error when the API omits a message', function () {
        $httpBackend.expect('POST', '/api/users/password').respond(400, {
          message: '',
        });
        ProfileEditAccountController.changeUserPassword();
        $httpBackend.flush();

        expect(messageCenterService.add).toHaveBeenCalledWith(
          'danger',
          'Password not changed due error, try again.',
          { timeout: 10000 },
        );
      });
    });

    describe('push notifications', function () {
      it('enables and disables push based on the toggle state', function () {
        ProfileEditAccountController.push.enable = jasmine.createSpy('enable');
        ProfileEditAccountController.push.disable =
          jasmine.createSpy('disable');

        ProfileEditAccountController.pushEnabled = true;
        ProfileEditAccountController.pushUpdate();
        expect(ProfileEditAccountController.push.enable).toHaveBeenCalled();

        ProfileEditAccountController.pushEnabled = false;
        ProfileEditAccountController.pushUpdate();
        expect(ProfileEditAccountController.push.disable).toHaveBeenCalled();
      });

      it('disables push controls when push is busy, blocked, unsupported, or native mobile', function () {
        ProfileEditAccountController.push.isBusy = false;
        ProfileEditAccountController.push.isBlocked = false;
        ProfileEditAccountController.push.isSupported = true;
        ProfileEditAccountController.isNativeMobileApp = false;
        expect(ProfileEditAccountController.pushIsDisabled()).toBe(false);

        ProfileEditAccountController.push.isBusy = true;
        expect(ProfileEditAccountController.pushIsDisabled()).toBe(true);

        ProfileEditAccountController.push.isBusy = false;
        ProfileEditAccountController.push.isBlocked = true;
        expect(ProfileEditAccountController.pushIsDisabled()).toBe(true);

        ProfileEditAccountController.push.isBlocked = false;
        ProfileEditAccountController.push.isSupported = false;
        expect(ProfileEditAccountController.pushIsDisabled()).toBe(true);

        ProfileEditAccountController.push.isSupported = true;
        ProfileEditAccountController.isNativeMobileApp = true;
        expect(ProfileEditAccountController.pushIsDisabled()).toBe(true);
      });
    });

    describe('email subscriptions', function () {
      it('updates email subscriptions', function () {
        ProfileEditAccountController.user.newsletter = true;
        const updatedUser = {
          _id: 'user',
          displayName: 'User',
          newsletter: true,
        };

        $httpBackend.expect('PUT', '/api/users').respond(200, updatedUser);
        ProfileEditAccountController.updateUserSubscriptions();
        expect(ProfileEditAccountController.updatingUserSubscriptions).toEqual(
          true,
        );
        $httpBackend.flush();

        expect(messageCenterService.add).toHaveBeenCalledWith(
          'success',
          'Subscriptions updated.',
        );
        expect(ProfileEditAccountController.updatingUserSubscriptions).toEqual(
          false,
        );
        expect(Authentication.user).toMatchObject(updatedUser);
      });

      it('shows subscription update errors', function () {
        $httpBackend.expect('PUT', '/api/users').respond(400, {
          message: 'Subscription update failed.',
        });
        ProfileEditAccountController.updateUserSubscriptions();
        $httpBackend.flush();

        expect(ProfileEditAccountController.updatingUserSubscriptions).toEqual(
          false,
        );
        expect(messageCenterService.add).toHaveBeenCalledWith(
          'error',
          'Error: Subscription update failed.',
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

      it('falls back to a generic profile removal success message', function () {
        ProfileEditAccountController.removeProfileConfirm = true;

        $httpBackend.expect('DELETE', '/api/users').respond(200, {});
        ProfileEditAccountController.removeProfile();
        $httpBackend.flush();

        expect(ProfileEditAccountController.removeProfileInitialized).toEqual(
          'Success.',
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

      it('prevents the default event when resending email', function () {
        const event = {
          preventDefault: jasmine.createSpy('preventDefault'),
        };

        $httpBackend
          .expect('POST', '/api/auth/resend-confirmation')
          .respond(200);
        ProfileEditAccountController.resendUserEmailConfirm(event);
        $httpBackend.flush();

        expect(event.preventDefault).toHaveBeenCalled();
      });

      it('does not resend confirmation when no temporary email exists', function () {
        delete ProfileEditAccountController.user.emailTemporary;

        ProfileEditAccountController.resendUserEmailConfirm();
        expect(messageCenterService.add).not.toHaveBeenCalledWith(
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

      it('falls back to a generic error when resend rejection omits a response', function () {
        inject(function ($controller, $rootScope) {
          const controller = $controller('ProfileEditAccountController', {
            Authentication,
            messageCenterService,
            $scope: $rootScope.$new(),
            push: {},
            $http: {
              post: jasmine.createSpy('$http.post').and.returnValue({
                then() {
                  return {
                    catch(callback) {
                      callback();
                    },
                  };
                },
              }),
            },
          });

          controller.resendUserEmailConfirm();
        });

        expect(messageCenterService.add).toHaveBeenCalledWith(
          'danger',
          'Something went wrong.',
        );
      });
    });
  });
});
