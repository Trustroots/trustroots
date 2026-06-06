import '@/modules/offers/client/offers.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('Offers Route Tests', function () {
  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(
    angular.mock.module(function ($urlRouterProvider) {
      $urlRouterProvider.deferIntercept();
    }),
  );

  describe('Route Config', function () {
    let mainstate;

    it('configures root offer route', inject(function ($state) {
      mainstate = $state.get('offer');

      expect(mainstate.url).toEqual('/offer');
      expect(mainstate.abstract).toBe(true);
      expect(mainstate.requiresAuth).toBe(true);
      expect(mainstate.templateUrl).toBe(
        '/modules/offers/views/offer.client.view.html',
      );
    }));

    it('loads default map location from LocationService', inject(function (
      $state,
      $injector,
    ) {
      mainstate = $state.get('offer');

      const LocationService = {
        getDefaultLocation: jest
          .fn()
          .mockReturnValue({ lat: 10, lng: 20, zoom: 4 }),
      };

      expect(
        $injector.invoke(mainstate.resolve.defaultLocation, null, {
          LocationService,
        }),
      ).toEqual({ lat: 10, lng: 20, zoom: 4 });
      expect(LocationService.getDefaultLocation).toHaveBeenCalledWith(4);
    }));

    it('loads host offer list for current user', inject(function (
      $state,
      $injector,
    ) {
      const state = $state.get('offer.host');
      const OffersByService = {
        query: jest.fn().mockReturnValue('host-offers'),
      };
      const Authentication = {
        user: {
          _id: 'host-user-id',
        },
      };

      expect(
        $injector.invoke(state.resolve.offers, null, {
          OffersByService,
          Authentication,
        }),
      ).toBe('host-offers');
      expect(OffersByService.query).toHaveBeenCalledWith({
        userId: 'host-user-id',
        types: 'host',
      });
    }));

    it('loads meet offer list for current user', inject(function (
      $state,
      $injector,
    ) {
      const state = $state.get('offer.meet.list');
      const OffersByService = {
        query: jest.fn().mockReturnValue('meet-offers'),
      };
      const Authentication = {
        user: {
          _id: 'meet-user-id',
        },
      };

      expect(
        $injector.invoke(state.resolve.offers, null, {
          OffersByService,
          Authentication,
        }),
      ).toBe('meet-offers');
      expect(OffersByService.query).toHaveBeenCalledWith({
        userId: 'meet-user-id',
        types: 'meet',
      });
    }));

    it('loads meeting offer by route parameter', inject(function (
      $state,
      $injector,
    ) {
      const state = $state.get('offer.meet.edit');
      const offerResponse = {
        $promise: Promise.resolve({
          _id: 'offer-id',
        }),
      };
      const OffersService = {
        get: jest.fn().mockReturnValue(offerResponse),
      };

      expect(
        $injector.invoke(state.resolve.offer, null, {
          OffersService,
          $stateParams: {
            offerId: 'offer-id',
          },
        }),
      ).toBe(offerResponse.$promise);
      expect(OffersService.get).toHaveBeenCalledWith({
        offerId: 'offer-id',
      });
    }));
  });
});
