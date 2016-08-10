(function () {
  'use strict';

  describe('Search Route Tests', function () {

    // We can start by loading the main application module
    beforeEach(module(AppConfig.appModuleName));

    beforeEach(inject(function ($rootScope, $templateCache) {
      $templateCache.put('/modules/pages/views/home.client.view.html', '');
    }));

    describe('Route Config', function () {
      describe('Main Route', function () {
        var mainstate;
        beforeEach(inject(function ($state, $templateCache) {
          // Test expected GET request
          $templateCache.put('/modules/search/views/search.client.view.html', '');
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
        beforeEach(inject(function ($state, $rootScope, $templateCache) {
          // Test expected GET request
          $templateCache.put('/modules/search/views/search.client.view.html', '');

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

}());
