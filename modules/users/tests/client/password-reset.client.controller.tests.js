import '@/modules/users/client/users.client.module';
import '@/modules/search/client/search.client.module';
import AppConfig from '@/modules/core/client/app/config';

// Authentication controller Spec
describe('ResetPasswordController', function () {
  // Initialize global variables
  let $scope;
  let $httpBackend;
  let $stateParams;
  let $location;
  let $window;
  let Authentication;

  // Load the main application module
  beforeEach(angular.mock.module(AppConfig.appModuleName));

  describe('Logged out user', function () {
    beforeEach(inject(function (
      $controller,
      $rootScope,
      _$window_,
      _$stateParams_,
      _$httpBackend_,
      _$location_,
      _Authentication_,
    ) {
      // Set a new global $scope
      $scope = $rootScope.$new();

      // Point global variables to injected services
      $stateParams = _$stateParams_;
      $httpBackend = _$httpBackend_;
      $location = _$location_;
      $location.path = jasmine.createSpy().and.returnValue(true);
      $window = _$window_;
      $window.user = null;
      Authentication = _Authentication_;

      Authentication.user = null;

      // Initialize the Authentication controller
      $controller('ResetPasswordController as vm', {
        $scope,
      });
    }));

    it('should not redirect to home', function () {
      expect($location.path).not.toHaveBeenCalledWith('/');
    });

    describe('resetUserPassword', function () {
      const token = 'testToken';
      const passwordDetails = {
        password: 'test',
      };
      beforeEach(function () {
        // Test expected GET request
        $httpBackend
          .when(
            'GET',
            '/modules/users/views/password/reset-password-success.client.view.html',
          )
          .respond(200, '');

        Authentication.user = null;
        $stateParams.token = token;
        $scope.vm.passwordDetails = passwordDetails;
      });

      it('should clear $scope.vm.success and $scope.vm.error', function () {
        $scope.vm.error = 'test';
        $scope.vm.resetUserPassword();
        expect($scope.vm.error).toBeNull();
      });

      it('POST error should set $scope.vm.error to response message', function () {
        const errorMessage = 'Passwords do not match';
        $httpBackend
          .when('POST', '/api/auth/reset/' + token, passwordDetails)
          .respond(400, {
            message: errorMessage,
          });

        $scope.vm.resetUserPassword();
        $httpBackend.flush();

        expect($scope.vm.error).toBe(errorMessage);
      });

      describe('POST success', function () {
        const user = {
          username: 'test',
        };
        beforeEach(function () {
          // Test expected requests
          $httpBackend
            .when(
              'GET',
              '/modules/users/views/password/reset-password-success.client.view.html',
            )
            .respond(200, '');
          $httpBackend
            .when('POST', '/api/auth/reset/' + token, passwordDetails)
            .respond(user);

          Authentication.user = null;
          $scope.vm.resetUserPassword();
          $httpBackend.flush();
        });

        it('should clear password form', function () {
          expect($scope.vm.passwordDetails).toBeNull();
        });

        it('should attach user profile', function () {
          expect(Authentication.user).toEqual(user);
        });

        it('should redirect to password reset success view', function () {
          expect($location.path).toHaveBeenCalledWith(
            '/password/reset/success',
          );
        });
      });
    });
  });
});
