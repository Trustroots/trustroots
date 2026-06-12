import '@/modules/offers/client/offers.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('OfferHostViewController', function () {
  let $controller;
  let $rootScope;
  let $scope;
  let OffersByService;

  beforeEach(function () {
    OffersByService = {
      query: jasmine.createSpy('OffersByService.query'),
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('OffersByService', OffersByService);
    });
  });

  beforeEach(inject(function (_$controller_, _$rootScope_) {
    $controller = _$controller_;
    $rootScope = _$rootScope_;
  }));

  function createController(profile = null, offers = []) {
    $scope = $rootScope.$new();
    $scope.profileCtrl = {
      profile,
    };

    OffersByService.query.and.callFake(function (_, callback) {
      callback(offers);
    });

    const controller = $controller('OfferHostViewController as vm', {
      $scope,
      OffersByService,
    });
    $rootScope.$digest();

    return { controller, scope: $scope };
  }

  it('queries offers only when profile is ready', function () {
    createController({ _id: 'u1', $resolved: true });
    expect(OffersByService.query).toHaveBeenCalledWith(
      { userId: 'u1', types: 'host' },
      jasmine.any(Function),
    );

    createController({ _id: 'u2', $resolved: false });
    expect(OffersByService.query).toHaveBeenCalledTimes(1);
  });

  it('loads the first available offer and marks it resolved', function () {
    const { controller } = createController({ _id: 'u1', $resolved: true }, [
      { _id: 'o1', title: 'Offer', status: 'yes' },
    ]);

    expect(controller.offer).toEqual(
      jasmine.objectContaining({
        _id: 'o1',
        title: 'Offer',
      }),
    );
    expect(controller.offer.$resolved).toBe(true);
  });

  it('keeps offer state false when no offers are returned', function () {
    const { controller } = createController({ _id: 'u1', $resolved: true }, []);

    expect(controller.offer).toBe(false);
    expect(controller.hostingStatusLabel('yes')).toBe('Can host');
  });

  it('maps hosting status labels', function () {
    const { controller } = createController({
      _id: 'u1',
      $resolved: true,
    });

    expect(controller.hostingStatusLabel('yes')).toBe('Can host');
    expect(controller.hostingStatusLabel('maybe')).toBe(
      'Might be able to host',
    );
    expect(controller.hostingStatusLabel('no')).toBe('Cannot host currently');
  });
});
