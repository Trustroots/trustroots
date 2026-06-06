import '@/modules/offers/client/offers.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('OfferHostEditController', function () {
  let $controller;
  let $q;
  let $rootScope;
  let $scope;
  let $timeout;
  let Authentication;
  let createdOffers;
  let createOrUpdateDeferred;
  let messageCenterService;

  const defaultLocation = {
    lat: 12,
    lng: 34,
    zoom: 4,
  };

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (
    _$controller_,
    _$q_,
    _$rootScope_,
    _$timeout_,
    _Authentication_,
    _messageCenterService_,
  ) {
    $controller = _$controller_;
    $q = _$q_;
    $rootScope = _$rootScope_;
    $timeout = _$timeout_;
    Authentication = _Authentication_;
    messageCenterService = _messageCenterService_;

    spyOn(messageCenterService, 'add').and.callThrough();
  }));

  function OffersService(data) {
    angular.extend(this, data);
    this.createOrUpdate = jasmine
      .createSpy('offer.createOrUpdate')
      .and.callFake(function () {
        return createOrUpdateDeferred.promise;
      });
    createdOffers.push(this);
  }

  function offersWithPromise(items, promise) {
    const offers = items.slice();
    offers.$promise = promise || $q.resolve();
    return offers;
  }

  function createController(options = {}) {
    createdOffers = [];
    createOrUpdateDeferred = $q.defer();
    $scope = $rootScope.$new();
    Authentication.user = {
      username: 'alice',
      locationFrom: '',
      locationLiving: '',
      ...options.user,
    };

    const map = {
      invalidateSize: jasmine.createSpy('map.invalidateSize'),
    };
    const leafletData = {
      getMap: jasmine
        .createSpy('leafletData.getMap')
        .and.returnValue($q.resolve(map)),
    };
    const $analytics = {
      eventTrack: jasmine.createSpy('$analytics.eventTrack'),
    };
    const $state = {
      go: jasmine.createSpy('$state.go'),
    };
    const $window = {
      innerWidth: options.innerWidth || 1024,
    };
    const offers =
      options.offers ||
      offersWithPromise(
        options.offerItems || [
          {
            _id: 'offer-1',
            description: 'Existing hosting offer',
            location: ['60.17', '24.94'],
            maxGuests: 2,
            status: 'maybe',
          },
        ],
        options.offersPromise,
      );

    const controller = $controller('OfferHostEditController as offerHostEdit', {
      $analytics,
      $scope,
      $state,
      $stateParams: options.stateParams || {},
      $window,
      defaultLocation: { ...defaultLocation },
      leafletData,
      OffersService,
      offers,
    });

    if (options.digest !== false) {
      $rootScope.$digest();
    }

    return {
      $analytics,
      $state,
      controller,
      leafletData,
      map,
    };
  }

  it('loads an existing hosting offer and centers the map on its location', function () {
    const { controller } = createController({
      stateParams: {
        status: 'no',
      },
    });

    expect(controller.isLoading).toBe(false);
    expect(controller.offer).toBe(createdOffers[0]);
    expect(controller.offer.status).toBe('no');
    expect(controller.offer.type).toBe('host');
    expect(controller.mapCenter).toEqual({
      lat: 60.17,
      lng: 24.94,
      zoom: 16,
    });
  });

  it('loads an existing hosting offer without map coordinates', function () {
    const { controller } = createController({
      offerItems: [
        {
          _id: 'offer-1',
          description: 'Existing hosting offer',
          location: null,
          status: 'maybe',
        },
      ],
    });

    expect(controller.offer).toBe(createdOffers[0]);
    expect(controller.mapCenter).toEqual(defaultLocation);
  });

  it('keeps defaults when the existing offer list is empty', function () {
    const { controller } = createController({
      offerItems: [],
    });

    expect(controller.isLoading).toBe(false);
    expect(controller.offer).toBeUndefined();
    expect(createdOffers).toHaveLength(0);
  });

  it('creates a default hosting offer and searches from the living location', function () {
    const { controller } = createController({
      offers: offersWithPromise([], $q.reject({ status: 404 })),
      user: {
        locationLiving: 'Helsinki, Finland',
        locationFrom: 'Lisbon, Portugal',
      },
    });

    expect(controller.isLoading).toBe(false);
    expect(controller.firstTimeAround).toBe(true);
    expect(controller.searchQuery).toBe('Helsinki, Finland');
    expect(controller.offer).toEqual(
      jasmine.objectContaining({
        description: '',
        maxGuests: 1,
        noOfferDescription: '',
        showOnlyInMyCircles: false,
        status: 'yes',
        type: 'host',
      }),
    );
  });

  it('falls back to the from location when a new host has no living location', function () {
    const { controller } = createController({
      offers: offersWithPromise([], $q.reject({ status: 404 })),
      user: {
        locationFrom: 'Lisbon, Portugal',
        locationLiving: '',
      },
    });

    expect(controller.searchQuery).toBe('Lisbon, Portugal');
  });

  it('leaves the search query empty for new hosts without profile locations', function () {
    const { controller } = createController({
      offers: offersWithPromise([], $q.reject({ status: 404 })),
    });

    expect(controller.searchQuery).toBe('');
    expect(controller.firstTimeAround).toBe(true);
  });

  it('marks the offer as unavailable when loading fails with a non-404 error', function () {
    const { controller } = createController({
      offers: offersWithPromise([], $q.reject({ status: 500 })),
    });

    expect(controller.isLoading).toBe(false);
    expect(controller.offer).toBe(false);
  });

  it('updates the short-description state from the plain text length', function () {
    const { controller } = createController();

    controller.offer.description = '<p>Hey</p>';
    $scope.$digest();
    expect(controller.isDescriptionTooShort).toBe(true);

    controller.offer.description = '<p>Welcome to my home</p>';
    $scope.$digest();
    expect(controller.isDescriptionTooShort).toBe(false);
  });

  it('invalidates the Leaflet map after the map tab becomes visible', function () {
    const { controller, leafletData, map } = createController();

    controller.invalidateMapSize();
    $timeout.flush();
    $rootScope.$digest();

    expect(leafletData.getMap).toHaveBeenCalled();
    expect(map.invalidateSize).toHaveBeenCalledWith(false);
  });

  it('saves the offer, tracks analytics, and returns mobile users to accommodation', function () {
    const { $analytics, $state, controller } = createController({
      innerWidth: 375,
    });

    controller.mapCenter = {
      lat: '61.49',
      lng: '23.78',
      zoom: 13,
    };
    controller.editOffer();

    expect(controller.offer.location).toEqual([61.49, 23.78]);
    expect(controller.offer.createOrUpdate).toHaveBeenCalled();

    createOrUpdateDeferred.resolve();
    $rootScope.$digest();

    expect(controller.isLoading).toBe(false);
    expect($analytics.eventTrack).toHaveBeenCalledWith('offer-modified', {
      category: 'offer.edit',
      label: 'Modified offer',
      value: 'maybe',
    });
    expect($state.go).toHaveBeenCalledWith('profile.accommodation', {
      username: 'alice',
    });
  });

  it('does not submit while the initial offer is still loading', function () {
    const { controller } = createController({
      digest: false,
    });

    controller.editOffer();

    expect(controller.isLoading).toBe(true);
    expect(createdOffers).toHaveLength(0);
  });

  it('returns desktop users to their profile about page after saving', function () {
    const { $state, controller } = createController({
      innerWidth: 1024,
    });

    controller.editOffer();
    createOrUpdateDeferred.resolve();
    $rootScope.$digest();

    expect($state.go).toHaveBeenCalledWith('profile.about', {
      username: 'alice',
    });
  });

  it('shows the API error message when saving fails', function () {
    const { controller } = createController();

    controller.editOffer();
    createOrUpdateDeferred.reject({
      data: {
        message: 'Please choose a valid location.',
      },
    });
    $rootScope.$digest();

    expect(controller.isLoading).toBe(false);
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Please choose a valid location.',
    );
  });

  it('shows a generic error when saving fails without an API message', function () {
    const { controller } = createController();

    controller.editOffer();
    createOrUpdateDeferred.reject({});
    $rootScope.$digest();

    expect(controller.isLoading).toBe(false);
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Snap! Something went wrong. If this keeps happening, please contact us.',
    );
  });
});
