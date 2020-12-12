import '@/modules/users/client/users.client.module';
import '@/modules/search/client/search.client.module';
import AppConfig from '@/modules/core/client/app/config';

// Authentication controller Spec
describe('ForgotPasswordController', function () {
  // Initialize global variables
  let $scope;
  let $httpBackend;
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
      _$httpBackend_,
      _$location_,
      _Authentication_,
    ) {
      // Set a new global $scope
      $scope = $rootScope.$new();

      // Point global variables to injected services
      $httpBackend = _$httpBackend_;
      $location = _$location_;
      $location.path = jasmine.createSpy().and.returnValue(true);
      $window = _$window_;
      $window.user = null;
      Authentication = _Authentication_;

      // Initialize the Authentication controller
      $controller('ForgotPasswordController as vm', {
        $scope,
      });
    }));

    it('should not redirect to home', function () {
      expect($location.path).not.toHaveBeenCalledWith('/');
    });

    describe('askForPasswordReset', function () {
      const credentials = {
        username: 'test',
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
        $scope.vm.credentials = credentials;
        Authentication.user = null;
      });

      it('should clear $scope.vm.success and $scope.vm.error', function () {
        $scope.vm.success = 'test';
        $scope.vm.error = 'test';
        $scope.vm.askForPasswordReset();

        expect($scope.vm.success).toBeNull();
        expect($scope.vm.error).toBeNull();
      });

      describe('POST error', function () {
        const errorMessage = 'No account with that username has been found';
        beforeEach(function () {
          // Test expected GET request
          $httpBackend
            .when(
              'GET',
              '/modules/users/views/password/reset-password-success.client.view.html',
            )
            .respond(200, '');
          $httpBackend
            .when('POST', '/api/auth/forgot', credentials)
            .respond(400, {
              message: errorMessage,
            });

          Authentication.user = null;
          $scope.vm.askForPasswordReset();
          $httpBackend.flush();
        });

        it('should not clear form', function () {
          expect($scope.vm.credentials).not.toBeNull();
        });

        it('should set error to response message', function () {
          expect($scope.vm.error).toBe(errorMessage);
        });
      });

      describe('POST success', function () {
        const successMessage =
          'An email has been sent to the provided email with further instructions.';
        beforeEach(function () {
          // Test expected requests
          $httpBackend
            .when(
              'GET',
              '/modules/users/views/password/reset-password-success.client.view.html',
            )
            .respond(200, '');
          $httpBackend.when('POST', '/api/auth/forgot', credentials).respond({
            message: successMessage,
          });

          Authentication.user = null;
          $scope.vm.askForPasswordReset();
          $httpBackend.flush();
        });

        it('should clear form', function () {
          expect($scope.vm.credentials).toBeNull();
        });

        it('should set success to response message', function () {
          expect($scope.vm.success).toBe(successMessage);
        });
      });
    });
  });
});
