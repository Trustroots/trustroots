import AppConfig from '@/modules/core/client/app/config';

/**
 * App client controller tests
 */
describe('App Controller Tests', function () {
  let $scope;
  let $rootScope;
  let $controller;
  let $q;
  let $state;
  let Authentication;
  let SettingsFactory;
  let Languages;
  let push;
  let locker;
  let $window;
  let $location;
  let $uibModal;
  let $analytics;
  let trNativeAppBridge;

  // Load the main application module
  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(function () {
    push = {
      init: jasmine.createSpy('push.init'),
      disable: jasmine.createSpy('push.disable').and.callFake(function () {
        return Promise.resolve();
      }),
    };

    // Mock local storage
    locker = {
      supported: jasmine.createSpy('locker.supported').and.returnValue(true),
      clean: jasmine.createSpy('locker.clean'),
    };

    // Mock window hooks
    $window = {
      title: 'Trustroots',
      alert: jasmine.createSpy('window.alert'),
      scrollTo: jasmine.createSpy('window.scrollTo'),
      top: {
        location: {},
      },
      postMessage: jasmine.createSpy('window.postMessage'),
    };

    // Mock location service
    $location = {
      url: jasmine.createSpy('location.url').and.returnValue('/'),
      protocol: jasmine.createSpy('location.protocol').and.returnValue('https'),
      host: jasmine.createSpy('location.host').and.returnValue('localhost'),
    };

    $uibModal = {
      open: jasmine.createSpy('uibModal.open'),
    };

    $analytics = {
      eventTrack: jasmine.createSpy('analytics.eventTrack'),
      settings: {
        pageTracking: {
          autoTrackFirstPage: true,
          autoTrackVirtualPages: true,
        },
      },
    };

    trNativeAppBridge = {
      isNativeMobileApp: jasmine
        .createSpy('trNativeAppBridge.isNativeMobileApp')
        .and.returnValue(false),
      signalUnAuthenticated: jasmine.createSpy(
        'trNativeAppBridge.signalUnAuthenticated',
      ),
    };
  });

  beforeEach(
    angular.mock.module(function ($provide) {
      $provide.value('push', push);
      $provide.value('locker', locker);
      $provide.value('$window', $window);
      $provide.value('$location', $location);
      $provide.value('$uibModal', $uibModal);
      $provide.value('$analytics', $analytics);
      $provide.value('trNativeAppBridge', trNativeAppBridge);
    }),
  );

  beforeEach(inject(function (
    _$controller_,
    _$rootScope_,
    _$q_,
    _$state_,
    _Authentication_,
    _SettingsFactory_,
    _Languages_,
  ) {
    $q = _$q_;
    $controller = _$controller_;
    $rootScope = _$rootScope_;
    $scope = $rootScope.$new();
    $state = _$state_;

    Authentication = _Authentication_;
    SettingsFactory = _SettingsFactory_;
    Languages = _Languages_;

    push.disable.and.callFake(function () {
      return $q.when();
    });

    // Mock logged in user
    Authentication.user = {
      roles: ['user'],
    };

    spyOn(SettingsFactory, 'get').and.returnValue({});
    spyOn(Languages, 'get').and.returnValue({});
    spyOn($state, 'go');

    $rootScope.$apply();
  }));

  function createController() {
    return $controller('AppController as vm', {
      $scope,
      $state,
      $window,
      $location,
      $uibModal,
      $analytics,
      Authentication,
      SettingsFactory,
      Languages,
      locker,
      push,
      trNativeAppBridge,
    });
  }

  beforeEach(function () {
    createController();
  });

  it('should expose app settings', function () {
    expect(SettingsFactory.get).toHaveBeenCalled();
    // expect($scope.vm.appSettings).toBeTruthy();
  });

  it('should expose languages', function () {
    expect(Languages.get).toHaveBeenCalledWith('object');
    // expect($scope.vm.languageNames).toBeTruthy();
  });

  it('should expose photo credits', function () {
    expect($scope.vm.photoCredits).toBeTruthy();
    expect($scope.vm.photoCreditsCount).toEqual(0);
  });

  it('should expose the user', function () {
    expect($scope.vm.user).toBeTruthy();
  });

  it('should open maintenance modal when service is unavailable', function () {
    $rootScope.$broadcast('serviceUnavailable');

    expect($uibModal.open).toHaveBeenCalledTimes(1);
    const config = $uibModal.open.calls.argsFor(0)[0];
    expect(config.ariaLabelledBy).toBe('Service unavailable');
    expect(config.template).toContain(
      'Unfortunately Trustroots is down for a bit of maintenance',
    );
  });

  it('should update user on userUpdated event', function () {
    expect($scope.vm.user).toEqual(Authentication.user);

    Authentication.user = { _id: 'another-user', roles: ['admin'] };
    $scope.$broadcast('userUpdated');

    expect($scope.vm.user).toEqual(Authentication.user);
  });

  it('should mark unauthenticated state change as auth required', function () {
    Authentication.user = null;
    const toState = { requiresRole: 'admin', name: 'admin' };

    const event = $scope.$broadcast('$stateChangeStart', toState, {});

    expect(event.defaultPrevented).toBe(true);
    expect(toState.requiresAuth).toBe(true);
  });

  it('should redirect unauthorized users to volunteering page', function () {
    Authentication.user = { roles: ['user'] };
    const toState = { requiresRole: 'admin', name: 'admin' };

    const event = $scope.$broadcast('$stateChangeStart', toState, {});

    expect(event.defaultPrevented).toBe(true);
    expect($state.go).toHaveBeenCalledWith('volunteering');
  });

  it('should redirect users without roles to volunteering page', function () {
    Authentication.user = {};
    const toState = { requiresRole: 'admin', name: 'admin' };

    const event = $scope.$broadcast('$stateChangeStart', toState, {});

    expect(event.defaultPrevented).toBe(true);
    expect($state.go).toHaveBeenCalledWith('volunteering');
  });

  it('should allow users with required role to continue navigation', function () {
    Authentication.user = { roles: ['admin'] };
    const toState = { requiresRole: 'admin', name: 'admin' };

    const event = $scope.$broadcast('$stateChangeStart', toState, {});

    expect(event.defaultPrevented).toBe(false);
    expect($window.alert).not.toHaveBeenCalled();
    expect($state.go).not.toHaveBeenCalled();
  });

  it('should redirect not-signed-in users to signin', function () {
    Authentication.user = null;
    const toParams = { id: 'user-id' };
    const toState = { requiresAuth: true, name: 'profile' };

    const event = $scope.$broadcast('$stateChangeStart', toState, toParams);

    expect(event.defaultPrevented).toBe(true);
    expect($rootScope.signinState).toBe('profile');
    expect($rootScope.signinStateParams).toEqual(toParams);
    expect($state.go).toHaveBeenCalledWith('profile-signup');
  });

  it('should redirect not-signed-in users to default signin with continuation', function () {
    Authentication.user = null;
    const toParams = { invite: 'abc' };
    const toState = { requiresAuth: true, name: 'contacts' };

    const event = $scope.$broadcast('$stateChangeStart', toState, toParams);

    expect(event.defaultPrevented).toBe(true);
    expect($rootScope.signinState).toBe('contacts');
    expect($rootScope.signinStateParams).toEqual(toParams);
    expect($state.go).toHaveBeenCalledWith('signin', { continue: true });
  });

  it('should clear page state and scroll on successful state changes', function () {
    $scope.vm.photoCredits = { test: true };
    $scope.vm.photoCreditsCount = 1;

    $scope.$broadcast('$stateChangeSuccess', {
      footerHidden: true,
      headerHidden: true,
    });

    expect($scope.vm.isFooterHidden).toBe(true);
    expect($scope.vm.isHeaderHidden).toBe(true);
    expect($scope.vm.footerVariant).toBe('standard');
    expect($scope.vm.photoCredits).toEqual({});
    expect($scope.vm.photoCreditsCount).toBe(0);
    expect($window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('should use visible header and footer defaults on state changes', function () {
    $scope.vm.isFooterHidden = true;
    $scope.vm.isHeaderHidden = true;
    $scope.vm.footerVariant = 'admin';

    $scope.$broadcast('$stateChangeSuccess', {});

    expect($scope.vm.isFooterHidden).toBe(false);
    expect($scope.vm.isHeaderHidden).toBe(false);
    expect($scope.vm.footerVariant).toBe('standard');
    expect($window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('should use a route-specific footer variant on state changes', function () {
    $scope.$broadcast('$stateChangeSuccess', {
      footerVariant: 'admin',
    });

    expect($scope.vm.isFooterHidden).toBe(false);
    expect($scope.vm.footerVariant).toBe('admin');
  });

  it('should update photo credits from directive events', function () {
    $scope.$broadcast('photoCreditsUpdated', {
      first: {
        title: 'Photo credits',
      },
    });

    expect($scope.vm.photoCredits).toEqual({
      first: { title: 'Photo credits' },
    });
    expect($scope.vm.photoCreditsCount).toBe(1);

    $scope.$broadcast('photoCreditsRemoved', { first: true });

    expect($scope.vm.photoCredits).toEqual({});
    expect($scope.vm.photoCreditsCount).toBe(0);
  });

  it('should navigate home to search for members and to home for guests', function () {
    Authentication.user = { roles: ['user'] };
    createController();
    $scope.vm.goHome();

    expect($state.go).toHaveBeenCalledWith('search.map');

    Authentication.user = null;
    createController();
    $scope.vm.goHome();

    expect($state.go).toHaveBeenCalledWith('home');
  });

  it('should sign out and mark unauthenticated on native bridge', function () {
    const event = {
      preventDefault: jasmine.createSpy('event.preventDefault'),
    };
    const onSignout = $scope.vm.signout.bind($scope.vm, event);

    onSignout();
    $rootScope.$apply();

    expect(event.preventDefault).toHaveBeenCalled();
    expect($analytics.eventTrack).toHaveBeenCalledWith('signout', {
      category: 'authentication',
      label: 'Sign out',
    });
    expect(locker.clean).toHaveBeenCalled();
    expect(push.disable).toHaveBeenCalled();
    expect($window.top.location.href).toBe('/api/auth/signout');
    expect($window.postMessage).toHaveBeenCalledWith(
      'unAuthenticated',
      'https://localhost',
    );
    expect(trNativeAppBridge.signalUnAuthenticated).toHaveBeenCalled();
  });

  it('should sign out without an event or postMessage hook', function () {
    $window.postMessage = undefined;

    $scope.vm.signout();
    $rootScope.$apply();

    expect($analytics.eventTrack).toHaveBeenCalledWith('signout', {
      category: 'authentication',
      label: 'Sign out',
    });
    expect(push.disable).toHaveBeenCalled();
    expect($window.top.location.href).toBe('/api/auth/signout');
    expect(trNativeAppBridge.signalUnAuthenticated).toHaveBeenCalled();
  });

  it('should ignore locker cleanup if locker is unsupported', function () {
    locker.supported.and.returnValue(false);
    const event = {
      preventDefault: jasmine.createSpy('event.preventDefault'),
    };
    const onSignout = $scope.vm.signout.bind($scope.vm, event);

    onSignout();
    $rootScope.$apply();

    expect(locker.clean).not.toHaveBeenCalled();
  });
});
