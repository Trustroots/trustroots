import '@/modules/offers/client/offers.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('OfferController', function () {
  let $controller;
  let $rootScope;
  let $q;
  let $timeout;
  const mapLayers = {
    streets: {
      name: 'Streets',
    },
  };

  beforeEach(function () {
    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('MapLayersFactory', {
        getLayers: jasmine
          .createSpy('MapLayersFactory.getLayers')
          .and.returnValue(mapLayers),
      });
    });
  });

  beforeEach(inject(function (_$controller_, _$rootScope_, _$q_, _$timeout_) {
    $controller = _$controller_;
    $rootScope = _$rootScope_;
    $q = _$q_;
    $timeout = _$timeout_;
  }));

  it('builds map configuration and layer settings', () => {
    const vm = $controller('OfferController as vm', {
      $scope: $rootScope.$new(),
    });

    expect(vm.mapLayers).toEqual({
      baselayers: mapLayers,
    });
    expect(vm.mapDefaults.scrollWheelZoom).toBe(false);
    expect(vm.mapDefaults.controls.layers.visible).toBe(false);
  });

  it('invalidates leaflet map size asynchronously', () => {
    const vm = $controller('OfferController as vm', {
      $scope: $rootScope.$new(),
    });
    const map = {
      invalidateSize: jest.fn(),
    };

    vm.invalidateMapSize({
      getMap: () => $q.resolve(map),
    });

    $timeout.flush(300);
    $rootScope.$apply();

    expect(map.invalidateSize).toHaveBeenCalledWith(false);
  });
});
