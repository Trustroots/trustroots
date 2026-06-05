import AppConfig from '@/modules/core/client/app/config';

describe('trNativeAppBridge service', function () {
  let $rootScope;
  let $timeout;
  let $location;
  let $window;
  let trNativeAppBridge;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (
    _$rootScope_,
    _$timeout_,
    _$location_,
    _$window_,
    _trNativeAppBridge_,
  ) {
    $rootScope = _$rootScope_;
    $timeout = _$timeout_;
    $location = _$location_;
    $window = _$window_;
    trNativeAppBridge = _trNativeAppBridge_;

    $window.postMessage = jasmine.createSpy('postMessage');
    $window.trMobileApp = {
      version: '1.0.0',
    };
    $window.isNativeMobileApp = false;

    spyOn($location, 'protocol').and.returnValue('https');
    spyOn($location, 'host').and.returnValue('localhost');
  }));

  afterEach(function () {
    document.body.innerHTML = '';
  });

  it('reports native-mobile availability from window flag', function () {
    expect(trNativeAppBridge.isNativeMobileApp()).toBe(false);

    $window.isNativeMobileApp = true;

    expect(trNativeAppBridge.isNativeMobileApp()).toBe(true);
  });

  it('returns fallback app info when no bridge payload is present', function (done) {
    let resolvedApp;
    let onMessage;

    $window.isNativeMobileApp = false;
    $window.trMobileApp = null;

    spyOn(document, 'addEventListener').and.callFake(function (_type, handler) {
      if (_type === 'message') {
        onMessage = handler;
      }
    });

    trNativeAppBridge
      .activate()
      .then(function (app) {
        resolvedApp = app;
      }, done.fail)
      .finally(function () {
        expect(resolvedApp).toEqual({ res: 'No data' });
        done();
      });

    onMessage({ data: 'trMobileAppInit' });
    $rootScope.$apply();
  });

  it('sends only native-friendly messages', function () {
    trNativeAppBridge.signalAuthenticated();
    trNativeAppBridge.signalUnAuthenticated();
    expect($window.postMessage).not.toHaveBeenCalled();

    $window.isNativeMobileApp = true;

    trNativeAppBridge.signalAuthenticated();
    trNativeAppBridge.signalUnAuthenticated();

    expect($window.postMessage).toHaveBeenCalledWith(
      '{"action":"authenticated"}',
    );
    expect($window.postMessage).toHaveBeenCalledWith(
      '{"action":"unAuthenticated"}',
    );
  });

  it('sets up bridge hooks after mobile init event', function (done) {
    let onMessage;

    spyOn(document, 'addEventListener').and.callFake(function (_type, handler) {
      if (_type === 'message') {
        onMessage = handler;
      }
    });

    const stateChangeSpy = spyOn($rootScope, '$on').and.callThrough();

    trNativeAppBridge.activate();
    onMessage({ data: 'trMobileAppInit' });
    $rootScope.$apply();

    expect(stateChangeSpy).toHaveBeenCalledWith(
      '$stateChangeSuccess',
      jasmine.any(Function),
    );
    expect($window.postMessage).not.toHaveBeenCalled();

    done();
  });

  it('hooks outbound anchor clicks and forwards openUrl action', function () {
    let onMessage;

    $window.isNativeMobileApp = false;
    $window.trMobileApp = { version: '1.0.0' };
    document.body.innerHTML = `
      <a id="external" href="https://external.example/app">External</a>
      <a id="internal" href="https://localhost/profile/alice">Internal</a>
      <a id="with-state" href="https://external.example/app" ui-sref="profile.about">UI</a>
    `;

    spyOn(document, 'addEventListener').and.callFake(function (_type, handler) {
      if (_type === 'message') {
        onMessage = handler;
      }
    });

    trNativeAppBridge.activate();
    onMessage({ data: 'trMobileAppInit' });

    $window.isNativeMobileApp = true;
    $rootScope.$broadcast('$stateChangeSuccess');
    $timeout.flush();

    const external = document.getElementById('external');
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = spyOn(clickEvent, 'preventDefault');

    expect(external).toHaveClass('tr-app-urlified');
    expect(
      document.querySelectorAll('.tr-app-urlified').length,
    ).toBeGreaterThan(0);

    external.dispatchEvent(clickEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect($window.postMessage).toHaveBeenCalledWith(
      '{"action":"openUrl","url":"https://external.example/app"}',
    );
  });
});
