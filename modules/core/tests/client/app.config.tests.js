describe('AppConfig', function () {
  function loadAppConfig({ nodeEnv, sentryDsn }) {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalSentryDsn = window.SENTRY_DSN;
    const sentryInit = jest.fn();
    let AppConfig;

    jest.isolateModules(() => {
      jest.resetModules();
      process.env.NODE_ENV = nodeEnv;
      window.SENTRY_DSN = sentryDsn;

      jest.doMock('@/config/client/sentry', () => ({
        init: sentryInit,
      }));

      AppConfig = require('@/modules/core/client/app/config').default;
    });

    process.env.NODE_ENV = originalNodeEnv;
    window.SENTRY_DSN = originalSentryDsn;

    return { AppConfig, sentryInit };
  }

  it('uses test environment config by default', function () {
    const { AppConfig } = loadAppConfig({
      nodeEnv: 'test',
      sentryDsn: undefined,
    });

    expect(AppConfig.appEnv).toBe('test');
    expect(AppConfig.appModuleVendorDependencies).toContain('angulartics.null');
    expect(AppConfig.appModuleVendorDependencies).not.toContain(
      'angulartics.google.analytics',
    );
    expect(AppConfig.appModuleVendorDependencies).not.toContain(
      'angulartics.debug',
    );
  });

  it('registers production analytics and initializes sentry when DSN exists', function () {
    const { AppConfig, sentryInit } = loadAppConfig({
      nodeEnv: 'production',
      sentryDsn: 'https://example.com/sentry',
    });

    expect(AppConfig.appModuleVendorDependencies).toContain('ngSentry');
    expect(AppConfig.appModuleVendorDependencies).toContain(
      'angulartics.google.analytics',
    );
    expect(AppConfig.appModuleVendorDependencies).not.toContain(
      'angulartics.debug',
    );
    expect(sentryInit).toHaveBeenCalledWith('https://example.com/sentry');
  });

  it('uses development analytics debug module for non-test/production env', function () {
    const { AppConfig } = loadAppConfig({
      nodeEnv: 'development',
      sentryDsn: undefined,
    });

    expect(AppConfig.appModuleVendorDependencies).toContain(
      'angulartics.debug',
    );
    expect(AppConfig.appModuleVendorDependencies).not.toContain(
      'angulartics.google.analytics',
    );
  });
});
