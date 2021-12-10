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
        Authentication.user = user;
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
