(function () {
  'use strict';

  describe('Search Route Tests', function () {
    // Initialize global variables
    var $scope,
        $httpBackend;

    //We can start by loading the main application module
    beforeEach(module(AppConfig.appModuleName));

    // The injector ignores leading and trailing underscores here (i.e. _$httpBackend_).
    // This allows us to inject a service but then attach it to a variable
    // with the same name as the service.
    beforeEach(inject(function ($rootScope, _$httpBackend_) {
      // Set a new global scope
      $scope = $rootScope.$new();
      $httpBackend = _$httpBackend_;
    }));

    describe('Route Config', function () {
      describe('Main Route', function () {
        var mainstate;
        beforeEach(inject(function ($state) {
          // Test expected GET request
          $httpBackend.when('GET', '/modules/pages/views/home.client.view.html').respond(200, '');
          $httpBackend.when('GET', '/modules/search/views/search.client.view.html').respond(200, '');

          mainstate = $state.get('search');
        }));

        it('Should have the correct URL', function () {
          expect(mainstate.url).toEqual('/search?location?offer');
        });

        it('Should not be abstract', function () {
          expect(mainstate.abstract).toBe(undefined);
        });

        it('Should have templateUrl', function () {
          expect(mainstate.templateUrl).toBe('/modules/search/views/search.client.view.html');
        });
      });

      describe('Handle Trailing Slash', function () {
        beforeEach(inject(function ($state, $rootScope, _Authentication_) {
          // Test expected GET request
          $httpBackend.when('GET', '/modules/pages/views/home.client.view.html').respond(200, '');
          $httpBackend.when('GET', '/modules/search/views/search.client.view.html').respond(200, '');

          $state.go('search');
          $rootScope.$digest();
        }));

        it('Should remove trailing slash', inject(function ($state, $location, $rootScope) {
          $location.path('search/');
          $rootScope.$digest();

          expect($location.path()).toBe('/search');
        }));
      });

    });
  });
})();
