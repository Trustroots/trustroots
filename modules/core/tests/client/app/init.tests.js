function defineServiceWorker(serviceWorker) {
  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: serviceWorker,
  });
}

function createProviderMocks() {
  return {
    lockerProvider: {
      defaults: jest.fn(),
    },
    cfpLoadingBarProvider: {},
    $analyticsProvider: {
      excludeRoutes: jest.fn(),
    },
    $locationProvider: {
      html5Mode: jest.fn().mockReturnThis(),
      hashPrefix: jest.fn(),
    },
    $urlMatcherFactoryProvider: {
      strictMode: jest.fn(),
    },
    $compileProvider: {
      aHrefSanitizationWhitelist: jest.fn(),
      commentDirectivesEnabled: jest.fn(),
      cssClassDirectivesEnabled: jest.fn(),
      debugInfoEnabled: jest.fn(),
    },
    $uibTooltipProvider: {
      options: jest.fn(),
    },
  };
}

function loadInit({ appEnv = 'test' } = {}) {
  let readyCallback;
  let registeredConfig;
  const config = jest.fn(callback => {
    registeredConfig = callback;
  });
  const module = jest.fn(() => ({ config }));
  const angularMock = {
    bootstrap: jest.fn(),
    element: jest.fn(() => ({
      ready: jest.fn(callback => {
        readyCallback = callback;
      }),
    })),
    module,
  };
  const appConfig = {
    appEnv,
    appModuleName: 'trustroots',
    appModuleVendorDependencies: ['ngMock'],
  };

  jest.isolateModules(() => {
    jest.resetModules();
    jest.doMock('angular', () => ({
      __esModule: true,
      default: angularMock,
    }));
    jest.doMock('@/modules/core/client/app/config', () => ({
      __esModule: true,
      default: appConfig,
    }));

    require('@/modules/core/client/app/init');
  });

  return {
    angularMock,
    appConfig,
    readyCallback,
    registeredConfig,
  };
}

describe('core app init', () => {
  afterEach(() => {
    defineServiceWorker(undefined);
    window.isNativeMobileApp = false;
    window.location.hash = '';
    window.history.pushState(null, '', '/');
    jest.restoreAllMocks();
  });

  it('registers the app module and production config providers', () => {
    const { angularMock, appConfig, registeredConfig } = loadInit({
      appEnv: 'production',
    });
    const providers = createProviderMocks();

    registeredConfig(
      providers.lockerProvider,
      providers.cfpLoadingBarProvider,
      providers.$analyticsProvider,
      providers.$locationProvider,
      providers.$urlMatcherFactoryProvider,
      providers.$compileProvider,
      providers.$uibTooltipProvider,
    );

    expect(angularMock.module).toHaveBeenCalledWith(
      appConfig.appModuleName,
      appConfig.appModuleVendorDependencies,
    );
    expect(providers.$analyticsProvider.excludeRoutes).toHaveBeenCalledWith([
      /^\/admin/,
    ]);
    expect(providers.$locationProvider.html5Mode).toHaveBeenCalledWith({
      enabled: true,
      requireBase: false,
    });
    expect(providers.$locationProvider.hashPrefix).toHaveBeenCalledWith('!');
    expect(
      providers.$urlMatcherFactoryProvider.strictMode,
    ).toHaveBeenCalledWith(false);
    expect(providers.cfpLoadingBarProvider.includeSpinner).toBe(false);
    expect(providers.lockerProvider.defaults).toHaveBeenCalledWith({
      driver: 'local',
      namespace: appConfig.appModuleName,
      separator: '.',
      eventsEnabled: false,
      extend: {},
    });
    expect(providers.$compileProvider.debugInfoEnabled).toHaveBeenCalledWith(
      false,
    );
    expect(
      providers.$compileProvider.commentDirectivesEnabled,
    ).toHaveBeenCalledWith(false);
    expect(
      providers.$compileProvider.cssClassDirectivesEnabled,
    ).toHaveBeenCalledWith(false);
    expect(
      providers.$compileProvider.aHrefSanitizationWhitelist,
    ).toHaveBeenCalledWith(/^\s*(geo|https?|ftp|mailto|tel|webcal|data|blob):/);
    expect(providers.$uibTooltipProvider.options).toHaveBeenCalledWith({
      appendToBody: true,
    });
  });

  it('boots the app, clears the facebook redirect hash, and registers service worker', () => {
    const register = jest.fn();
    defineServiceWorker({ register });
    window.location.hash = '#_=_';
    const { angularMock, appConfig, readyCallback } = loadInit({
      appEnv: 'production',
    });

    readyCallback();

    expect(window.location.hash).toBe('');
    expect(angularMock.bootstrap).toHaveBeenCalledWith(
      document,
      [appConfig.appModuleName],
      {
        strictDi: true,
      },
    );
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  it('escapes iframe getaway URLs without bootstrapping the app', () => {
    window.history.pushState(
      null,
      '',
      '/search?iframe_getaway=true&location=Berlin',
    );
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    const { angularMock, readyCallback } = loadInit();

    readyCallback();

    expect(open).toHaveBeenCalledWith(
      'http://localhost/search?iframe_cleaned=true&location=Berlin',
      '_top',
    );
    expect(angularMock.bootstrap).not.toHaveBeenCalled();
  });
});
