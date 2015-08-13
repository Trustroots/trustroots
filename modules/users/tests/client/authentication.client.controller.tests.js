'use strict';

(function () {
  // Authentication controller Spec
  describe('AuthenticationController', function () {
    // Initialize global variables
    var AuthenticationController,
      scope,
      $httpBackend,
      $stateParams,
      $location,
      $window;

    beforeEach(function () {
      jasmine.addMatchers({
        toEqualData: function (util, customEqualityTesters) {
          return {
            compare: function (actual, expected) {
              return {
                pass: angular.equals(actual, expected)
              };
            }
          };
        }
      });
    });

    // Load the main application module
    beforeEach(module(ApplicationConfiguration.applicationModuleName));

    describe('Logged out user', function () {
      // The injector ignores leading and trailing underscores here (i.e. _$httpBackend_).
      // This allows us to inject a service but then attach it to a variable
      // with the same name as the service.
      beforeEach(inject(function ($controller, $rootScope, _$location_, _$stateParams_, _$httpBackend_, _$window_) {
        // Set a new global scope
        scope = $rootScope.$new();
        $window = _$window_;

        // mocking settings
        $window.settings = {};

        // Point global variables to injected services
        $stateParams = _$stateParams_;
        $httpBackend = _$httpBackend_;
        $location = _$location_;
        $location = _$window_;

        // Initialize the Authentication controller
        AuthenticationController = $controller('AuthenticationController', {
          $scope: scope
        });
      }));

      describe('$scope.signin()', function () {
        it('should login with a correct user and password', function () {
          // Test expected GET request
          $httpBackend.when('POST', '/api/auth/signin').respond(200, 'Fred');
          $httpBackend.when('GET', 'modules/pages/views/home.client.view.html').respond(200, '');
          $httpBackend.when('GET', 'modules/search/views/search.client.view.html').respond(200, '');

          scope.signin();
          $httpBackend.flush();

          // Test scope value
          expect(scope.authentication.user).toEqual('Fred');
          //expect($location.url()).toEqual('/');
        });

        it('should fail to log in with nothing', function () {
          // Test expected POST request
          $httpBackend.expectPOST('/api/auth/signin').respond(400, {
            'message': 'Missing credentials'
          });
          $httpBackend.when('GET', 'modules/pages/views/home.client.view.html').respond(200, '');
          $httpBackend.when('GET', 'modules/search/views/search.client.view.html').respond(200, '');

          scope.signin();
          $httpBackend.flush();

          // Test scope value
          expect(scope.authentication.user).toEqual(undefined);
        });

      });

    });

  });
}());
