(function() {
  'use strict';

  // Authentication controller Spec
  describe('AuthenticationController', function() {
    // Initialize global variables
    var AuthenticationController,
        $scope,
        $httpBackend,
        $stateParams,
        $location,
        $state,
        $window,
        Authentication;

    beforeEach(function() {
      jasmine.addMatchers({
        toEqualData: function(util, customEqualityTesters) {
          return {
            compare: function(actual, expected) {
              return {
                pass: angular.equals(actual, expected)
              };
            }
          };
        }
      });
    });

    // Load the main application module
    beforeEach(module(AppConfig.appModuleName));

    describe('Logged out user', function () {

      var $scope,
          appSettings = {
            flashTimeout: 0
          };

      // The injector ignores leading and trailing underscores here (i.e. _$httpBackend_).
      // This allows us to inject a service but then attach it to a variable
      // with the same name as the service.
      beforeEach(inject(function($controller, $injector, $rootScope, _$location_, _$stateParams_, _$httpBackend_, _$window_, _$state_, _Authentication_) {
        // Set a new global $scope
        $scope = $rootScope.$new();
        $window = _$window_;

        // Point global variables to injected services
        $stateParams = _$stateParams_;
        $httpBackend = _$httpBackend_;
        $location = _$location_;
        $window = _$window_;
        $state = _$state_;
        Authentication = _Authentication_;

        // Initialize the Authentication controller
        AuthenticationController = $controller('AuthenticationController', {
          $scope: $scope,
          appSettings: appSettings
        });

        $scope.vm = AuthenticationController;
      }));

      describe('AuthenticationController.signin()', function() {
        it('should login with a correct user and password', function() {

          // Test expected GET request
          $httpBackend.when('POST', '/api/auth/signin').respond(200, 'Fred');
          $httpBackend.when('GET', 'modules/pages/views/home.client.view.html').respond(200, '');
          $httpBackend.when('GET', 'modules/search/views/search.client.view.html').respond(200, '');

          AuthenticationController.signin();
          $httpBackend.flush();

          // Test $scope value
          expect(Authentication.user).toEqual('Fred');
        });

        it('should fail to log in with nothing', function() {

          // Test expected POST request
          $httpBackend.expectPOST('/api/auth/signin').respond(400, {
            'message': 'Missing credentials'
          });
          $httpBackend.when('GET', 'modules/pages/views/home.client.view.html').respond(200, '');
          $httpBackend.when('GET', 'modules/search/views/search.client.view.html').respond(200, '');

          AuthenticationController.signin();
          $httpBackend.flush();

          // Test $scope value
          expect(Authentication.user).toEqual(undefined);
        });

      });

      describe('Logged in user', function () {
        beforeEach(inject(function ($controller, $rootScope, _$state_, _Authentication_) {
          $scope = $rootScope.$new();

          $state = _$state_;
          $state.go = jasmine.createSpy().and.returnValue(true);

          // Mock logged in user
          _Authentication_.user = {
            username: 'test',
            roles: ['user']
          };

          AuthenticationController = $controller('AuthenticationController', {
            $scope: $scope,
            appSettings: appSettings
          });
        }));

        it('should be redirected to home', function () {
          expect($state.go).toHaveBeenCalledWith('search');
        });
      });

    });

  });
}());
