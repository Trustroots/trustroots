(function () {
  describe('Search Route Tests', function () {

    // We can start by loading the main application module
    beforeEach(module(AppConfig.appModuleName));

    beforeEach(inject(function ($rootScope, $templateCache) {
      $templateCache.put('/modules/pages/views/home.client.view.html', '');
    }));

    describe('Route Config', function () {
      describe('Main Route', function () {
        let mainstate;
        beforeEach(inject(function ($state, $templateCache) {
          // Test expected GET request
          $templateCache.put('/modules/search/views/search.client.view.html', '');
          mainstate = $state.get('search');
        }));

        it('Should have the correct URL', function () {
          expect(mainstate.url).toEqual('/search?location?offer?tribe');
        });

        it('Should be abstract', function () {
          expect(mainstate.abstract).toBe(true);
        });

        it('Should have templateUrl', function () {
          expect(mainstate.templateUrl).toBe('/modules/search/views/search.client.view.html');
        });
      });

      describe('Map Route', function () {
        let mainstate;
        beforeEach(inject(function ($state, $templateCache) {
          // Test expected GET request
          $templateCache.put('/modules/search/views/search.client.view.html', '');
          $templateCache.put('/modules/search/views/search-map.client.view.html', '');
          $templateCache.put('/modules/search/views/search-sidebar.client.view.html', '');

          mainstate = $state.get('search.map');
        }));

        it('Should have the correct URL', function () {
          expect(mainstate.url).toEqual('');
        });

        it('Should not be abstract', function () {
          expect(mainstate.abstract).toBe(undefined);
        });

        it('Should have map and sidebar views', function () {
          expect(mainstate.views.map).toBeDefined();
          expect(mainstate.views.sidebar).toBeDefined();
        });

        it('Should have map templateUrl', function () {
          expect(mainstate.views.map.templateUrl).toBe('/modules/search/views/search-map.client.view.html');
        });

        it('Should have sidebar templateUrl', function () {
          expect(mainstate.views.sidebar.templateUrl).toBe('/modules/search/views/search-sidebar.client.view.html');
        });
      });

      describe('Search non-authenticated Route', function () {
        let mainstate;
        beforeEach(inject(function ($state, $templateCache) {
          // Test expected GET request
          $templateCache.put('/modules/search/views/search-signin.client.view.html', '');

          mainstate = $state.get('search-signin');
        }));

        it('Should have the correct URL', function () {
          expect(mainstate.url).toEqual('/search?location?offer?tribe');
        });

        it('Should not be abstract', function () {
          expect(mainstate.abstract).toBe(undefined);
        });

        it('Should have templateUrl', function () {
          expect(mainstate.templateUrl).toBe('/modules/search/views/search-signin.client.view.html');
        });
      });

      describe('Handle Trailing Slash', function () {
        beforeEach(inject(function ($state, $rootScope, $templateCache) {
          // Test expected GET request
          $templateCache.put('/modules/search/views/search.client.view.html', '');
          $templateCache.put('/modules/search/views/search-map.client.view.html', '');
          $templateCache.put('/modules/search/views/search-sidebar.client.view.html', '');

          $state.go('search.map');
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
