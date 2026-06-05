import '@/modules/search/client/search.client.module';
import '@/modules/offers/client/offers.client.module';
import '@/modules/tribes/client/tribes.client.module';

import AppConfig from '@/modules/core/client/app/config';

describe('Search Route Tests', function () {
  // We can start by loading the main application module
  beforeEach(angular.mock.module(AppConfig.appModuleName));

  describe('Route Config', function () {
    describe('Main Route', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
        mainstate = $state.get('search');
      }));

      it('Should have the correct URL', function () {
        expect(mainstate.url).toEqual('/search?location?offer?tribe');
      });

      it('Should be abstract', function () {
        expect(mainstate.abstract).toBe(true);
      });

      it('Should have templateUrl', function () {
        expect(mainstate.templateUrl).toBe(
          '/modules/search/views/search.client.view.html',
        );
      });

      it('Should not load an offer for invalid offer query params', inject(function (
        $injector,
      ) {
        const OffersService = {
          get: jest.fn(),
        };

        expect(
          $injector.invoke(mainstate.resolve.offer, null, {
            $stateParams: { offer: 'not-a-valid-offer-id' },
            OffersService,
          }),
        ).toBe(false);
        expect(OffersService.get).not.toHaveBeenCalled();
      }));

      it('Should load an offer for valid offer query params', inject(function (
        $injector,
      ) {
        const offerId = '507f1f77bcf86cd799439011';
        const offer = { _id: offerId };
        const OffersService = {
          get: jest.fn().mockReturnValue(offer),
        };

        expect(
          $injector.invoke(mainstate.resolve.offer, null, {
            $stateParams: { offer: offerId },
            OffersService,
          }),
        ).toBe(offer);
        expect(OffersService.get).toHaveBeenCalledWith({ offerId });
      }));
    });

    describe('Map Route', function () {
      let mainstate;
      beforeEach(inject(function ($state) {
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
        expect(mainstate.views.map.templateUrl).toBe(
          '/modules/search/views/search-map.client.view.html',
        );
      });

      it('Should have sidebar templateUrl', function () {
        expect(mainstate.views.sidebar.templateUrl).toBe(
          '/modules/search/views/search-sidebar.client.view.html',
        );
      });
    });

    describe('Handle Trailing Slash', function () {
      beforeEach(inject(function ($state, $rootScope, $location) {
        $state.go('search.map');
        $rootScope.$digest();
        expect($location.path()).toBe('/search');
      }));

      it('Should remove trailing slash', inject(function (
        $state,
        $location,
        $rootScope,
      ) {
        $location.path('search/');
        $rootScope.$digest();

        expect($location.path()).toBe('/search');
      }));
    });
  });
});
