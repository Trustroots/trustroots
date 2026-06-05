import '@/modules/offers/client/offers.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('OfferMeetAddController', function () {
  let $controller;
  let $rootScope;
  let $state;
  let $analytics;
  let defaultLocation;
  let messageCenterService;
  let OffersService;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(function () {
    messageCenterService = {
      add: jasmine.createSpy('messageCenterService.add'),
    };
  });

  beforeEach(
    angular.mock.module(function ($provide) {
      $provide.value('messageCenterService', messageCenterService);
    }),
  );

  beforeEach(inject(function (
    _$controller_,
    _$rootScope_,
    _$state_,
    _$analytics_,
  ) {
    $controller = _$controller_;
    $rootScope = _$rootScope_;
    $state = _$state_;
    $analytics = _$analytics_;

    spyOn($state, 'go');
    spyOn($analytics, 'eventTrack');
    defaultLocation = {
      lat: 10,
      lng: 20,
    };
  }));

  it('adds offer and navigates to list when save succeeds', function () {
    const saveOffer = { $save: jasmine.createSpy() };
    saveOffer.$save.and.callFake(function (success) {
      success();
    });
    OffersService = jasmine
      .createSpy('OffersService')
      .and.returnValue(saveOffer);

    const vm = $controller('OfferMeetAddController as vm', {
      $scope: $rootScope.$new(),
      $state,
      $analytics,
      leafletData: {},
      OffersService,
      messageCenterService,
      defaultLocation,
    });

    vm.offer = {
      description: 'Need company',
      validUntil: new Date('2026-01-01T12:00:00.000Z'),
    };
    vm.isLoading = false;

    vm.editOffer();

    expect(OffersService).toHaveBeenCalledWith(
      jasmine.objectContaining({
        type: 'meet',
        description: 'Need company',
        location: [10, 20],
        validUntil: new Date('2026-01-01T12:00:00.000Z'),
      }),
    );
    expect(saveOffer.$save).toHaveBeenCalled();
    expect($analytics.eventTrack).toHaveBeenCalledWith('offer-modified', {
      category: 'offer.meet.add',
      label: 'Added meet offer',
    });
    expect($state.go).toHaveBeenCalledWith('offer.meet.list');
    expect(vm.isLoading).toBe(false);
  });

  it('adds error message if saving fails', function () {
    const saveOffer = { $save: jasmine.createSpy() };
    saveOffer.$save.and.callFake(function (_success, error) {
      error({ data: { message: 'Could not save' } });
    });
    OffersService = jasmine
      .createSpy('OffersService')
      .and.returnValue(saveOffer);

    const vm = $controller('OfferMeetAddController as vm', {
      $scope: $rootScope.$new(),
      $state,
      $analytics,
      leafletData: {},
      OffersService,
      messageCenterService,
      defaultLocation,
    });

    vm.offer = {
      description: 'Need company',
      validUntil: new Date('2026-01-01T12:00:00.000Z'),
    };
    vm.isLoading = true;

    vm.editOffer();

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Could not save',
    );
    expect(vm.isLoading).toBe(false);
  });
});

describe('OfferMeetEditController', function () {
  let $controller;
  let $rootScope;
  let $q;
  let $state;
  let $analytics;
  let defaultLocation;
  let messageCenterService;
  let offer;
  let offerDeferred;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(function () {
    messageCenterService = {
      add: jasmine.createSpy('messageCenterService.add'),
    };
  });

  beforeEach(
    angular.mock.module(function ($provide) {
      $provide.value('messageCenterService', messageCenterService);
    }),
  );

  beforeEach(inject(function (
    _$controller_,
    _$rootScope_,
    _$q_,
    _$state_,
    _$analytics_,
  ) {
    $controller = _$controller_;
    $rootScope = _$rootScope_;
    $q = _$q_;
    $state = _$state_;
    $analytics = _$analytics_;

    spyOn($state, 'go');
    spyOn($analytics, 'eventTrack');
    defaultLocation = {
      lat: 10,
      lng: 20,
    };
  }));

  function createOffer(initialState) {
    offerDeferred = $q.defer();
    offer = {
      _id: 'offer-id',
      validUntil: '2026-01-01T12:00:00.000Z',
      location: ['60', '24'],
      ...initialState,
    };
    offer.$promise = offerDeferred.promise;
    return offer;
  }

  function promiseFinallyStub() {
    const result = {};
    result.finally = jasmine
      .createSpy('promise.finally')
      .and.callFake(function (callback) {
        callback();
        return result;
      });
    return result;
  }

  it('loads offer data on promise resolve and converts map coordinates', function () {
    createOffer();
    const vm = $controller('OfferMeetEditController as vm', {
      $scope: $rootScope.$new(),
      $state,
      $analytics,
      moment: require('moment'),
      leafletData: {},
      messageCenterService,
      offer,
      defaultLocation,
    });

    offerDeferred.resolve(offer);
    $rootScope.$apply();

    expect(vm.offer).toEqual(jasmine.objectContaining(offer));
    expect(vm.offer.validUntil).toEqual(jasmine.any(Date));
    expect(vm.mapCenter.lat).toBe(60);
    expect(vm.mapCenter.lng).toBe(24);
    expect(vm.mapCenter.zoom).toBe(16);
  });

  it('updates offer and sends user back to offer list with hash on success', function () {
    createOffer({ _id: 'offer-id' });
    offer.$update = jasmine.createSpy().and.callFake(function (success) {
      success();
      return promiseFinallyStub();
    });

    const vm = $controller('OfferMeetEditController as vm', {
      $scope: $rootScope.$new(),
      $state,
      $analytics,
      moment: require('moment'),
      leafletData: {},
      messageCenterService,
      offer,
      defaultLocation,
    });

    offerDeferred.resolve(offer);
    vm.offer.description = 'Updated offer';
    vm.offer.validUntil = new Date('2026-01-02T12:00:00.000Z');
    $rootScope.$apply();

    vm.editOffer();
    $rootScope.$apply();

    expect(offer.type).toBe('meet');
    expect(offer.status).toBe('yes');
    expect($analytics.eventTrack).toHaveBeenCalledWith('offer-modified', {
      category: 'offer.meet.update',
      label: 'Updated meet offer',
    });
    expect($state.go).toHaveBeenCalledWith('offer.meet.list', {
      '#': 'offer-offer-id',
    });
    expect(vm.isLoading).toBe(false);
  });

  it('shows error on failed offer update', function () {
    createOffer();
    offer._id = null;
    offer.$update = jasmine
      .createSpy()
      .and.callFake(function (_success, error) {
        error({ data: { message: 'Update failed' } });
        return promiseFinallyStub();
      });

    const vm = $controller('OfferMeetEditController as vm', {
      $scope: $rootScope.$new(),
      $state,
      $analytics,
      moment: require('moment'),
      leafletData: {},
      messageCenterService,
      offer,
      defaultLocation,
    });

    offerDeferred.resolve(offer);
    $rootScope.$apply();

    vm.editOffer();
    $rootScope.$apply();

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Update failed',
    );
    expect(vm.isLoading).toBe(false);
  });

  it('keeps offer unset when initial payload fails to load', function () {
    createOffer();
    const vm = $controller('OfferMeetEditController as vm', {
      $scope: $rootScope.$new(),
      $state,
      $analytics,
      moment: require('moment'),
      leafletData: {},
      messageCenterService,
      offer,
      defaultLocation,
    });

    offerDeferred.reject(new Error('not found'));
    $rootScope.$apply();

    expect(vm.offer).toBe(false);
    expect(vm.mapCenter).toEqual({
      lat: 10,
      lng: 20,
    });
  });

  it('routes to offer list without hash when offer has no id', function () {
    createOffer({ _id: null });
    offer.$update = jasmine.createSpy().and.callFake(function (success) {
      success();
      return promiseFinallyStub();
    });

    const vm = $controller('OfferMeetEditController as vm', {
      $scope: $rootScope.$new(),
      $state,
      $analytics,
      moment: require('moment'),
      leafletData: {},
      messageCenterService,
      offer,
      defaultLocation,
    });

    offerDeferred.resolve(offer);
    vm.offer.description = 'Updated offer';
    vm.offer.validUntil = new Date('2026-01-02T12:00:00.000Z');
    $rootScope.$apply();

    vm.editOffer();
    $rootScope.$apply();

    expect($state.go).toHaveBeenCalledWith('offer.meet.list');
    expect(vm.isLoading).toBe(false);
  });

  it('shows fallback error message when update fails without body', function () {
    createOffer();
    offer.$update = jasmine
      .createSpy()
      .and.callFake(function (_success, error) {
        error({ data: {} });
        return promiseFinallyStub();
      });

    const vm = $controller('OfferMeetEditController as vm', {
      $scope: $rootScope.$new(),
      $state,
      $analytics,
      moment: require('moment'),
      leafletData: {},
      messageCenterService,
      offer,
      defaultLocation,
    });

    offerDeferred.resolve(offer);
    $rootScope.$apply();

    vm.editOffer();
    $rootScope.$apply();

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Error occured. Please try again.',
    );
    expect(vm.isLoading).toBe(false);
  });
});

describe('OfferListMeetController', function () {
  let $controller;
  let $rootScope;
  let $q;
  let $analytics;
  let messageCenterService;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(function () {
    messageCenterService = {
      add: jasmine.createSpy('messageCenterService.add'),
    };
  });

  beforeEach(
    angular.mock.module(function ($provide) {
      $provide.value('messageCenterService', messageCenterService);
    }),
  );

  beforeEach(inject(function (_$controller_, _$rootScope_, _$q_, _$analytics_) {
    $controller = _$controller_;
    $rootScope = _$rootScope_;
    $q = _$q_;
    $analytics = _$analytics_;

    spyOn($analytics, 'eventTrack');
  }));

  it('schedules map refresh after state settle timeout', function () {
    const $anchorScroll = jasmine.createSpy('$anchorScroll');
    const $confirm = jasmine.createSpy().and.returnValue($q.resolve());
    const OffersService = jasmine
      .createSpy('OffersService')
      .and.callFake(() => ({
        $delete: jasmine.createSpy(),
      }));

    const vm = $controller('OfferListMeetController as vm', {
      $scope: $rootScope.$new(),
      offers: [],
      $timeout: jasmine.createSpy('$timeout').and.callFake(function (fn) {
        fn();
      }),
      $anchorScroll,
      $analytics,
      $confirm,
      OffersService,
      messageCenterService,
    });

    expect(vm.offers).toEqual([]);
    expect($anchorScroll).toHaveBeenCalled();
    expect($anchorScroll.yOffset).toEqual(jasmine.any(Function));
    expect($anchorScroll.yOffset()).toBe(50);
  });

  it('removes offer from list on successful delete confirm', function () {
    const offerToRemove = { _id: 'one', description: 'foo' };
    const offers = [offerToRemove, { _id: 'two', description: 'bar' }];
    const $confirm = jasmine.createSpy().and.returnValue($q.resolve());
    const OffersService = jasmine
      .createSpy('OffersService')
      .and.callFake(() => ({
        $delete: jasmine.createSpy().and.callFake(function (success) {
          success();
        }),
      }));
    const vm = $controller('OfferListMeetController as vm', {
      $scope: $rootScope.$new(),
      offers,
      $timeout: jasmine.createSpy().and.callFake(fn => fn()),
      $anchorScroll() {},
      $analytics,
      $confirm,
      OffersService,
      messageCenterService,
    });

    const removed = vm.remove(offerToRemove);
    $rootScope.$apply();

    expect(removed).toEqual(undefined);
    expect(vm.offers.length).toBe(1);
    expect(vm.offers[0]._id).toBe('two');
    expect($analytics.eventTrack).toHaveBeenCalledWith('offer-delete', {
      category: 'offer.meet.delete',
      label: 'Removed meet offer',
    });
  });

  it('shows error message when offer deletion fails', function () {
    const offerToRemove = { _id: 'one', description: 'foo' };
    const offers = [offerToRemove];
    const $confirm = jasmine.createSpy().and.returnValue($q.resolve());
    const OffersService = jasmine
      .createSpy('OffersService')
      .and.callFake(() => ({
        $delete: jasmine.createSpy().and.callFake(function (_success, error) {
          error({ data: { message: 'Could not delete' } });
        }),
      }));
    const vm = $controller('OfferListMeetController as vm', {
      $scope: $rootScope.$new(),
      offers,
      $timeout: jasmine.createSpy().and.callFake(fn => fn()),
      $anchorScroll() {},
      $analytics,
      $confirm,
      OffersService,
      messageCenterService,
    });

    vm.remove(offerToRemove);
    $rootScope.$apply();

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Could not delete',
    );
    expect(vm.offers).toHaveLength(1);
  });

  it('keeps offers unchanged when delete confirmation is cancelled', function () {
    const offerToRemove = { _id: 'one', description: 'foo' };
    const offers = [offerToRemove];
    const confirmDeferred = $q.defer();
    const $confirm = jasmine
      .createSpy()
      .and.returnValue(confirmDeferred.promise);
    const OffersService = jasmine
      .createSpy('OffersService')
      .and.callFake(() => ({
        $delete: jasmine.createSpy(),
      }));
    const vm = $controller('OfferListMeetController as vm', {
      $scope: $rootScope.$new(),
      offers,
      $timeout: jasmine.createSpy().and.callFake(fn => fn()),
      $anchorScroll() {},
      $analytics,
      $confirm,
      OffersService,
      messageCenterService,
    });

    vm.remove(offerToRemove);
    $rootScope.$apply();

    expect(OffersService).not.toHaveBeenCalled();
    expect(vm.offers).toEqual([offerToRemove]);
    expect(messageCenterService.add).not.toHaveBeenCalled();
    expect($analytics.eventTrack).not.toHaveBeenCalled();
  });

  it('uses header height when anchor target exists', function () {
    const originalAngularElement = angular.element;
    spyOn(angular, 'element').and.callFake(function (selector) {
      if (selector === '#tr-header') {
        return {
          length: 1,
          height() {
            return 15;
          },
        };
      }
      return originalAngularElement(selector);
    });

    const $anchorScroll = jasmine.createSpy('$anchorScroll');
    const $confirm = jasmine.createSpy().and.returnValue($q.resolve());
    const OffersService = jasmine
      .createSpy('OffersService')
      .and.callFake(() => ({
        $delete: jasmine.createSpy(),
      }));
    const vm = $controller('OfferListMeetController as vm', {
      $scope: $rootScope.$new(),
      offers: [],
      $timeout: jasmine.createSpy('$timeout').and.callFake(function (fn) {
        fn();
      }),
      $anchorScroll,
      $analytics,
      $confirm,
      OffersService,
      messageCenterService,
    });

    expect(vm.offers).toEqual([]);
    expect($anchorScroll.yOffset()).toBe(20);
  });
});
