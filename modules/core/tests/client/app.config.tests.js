describe('AppConfig', function () {
  function loadAppConfig({ nodeEnv }) {
    const originalNodeEnv = process.env.NODE_ENV;
    let AppConfig;

    jest.isolateModules(() => {
      jest.resetModules();
      if (nodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = nodeEnv;
      }
      AppConfig = require('@/modules/core/client/app/config').default;
    });

    process.env.NODE_ENV = originalNodeEnv;

    return AppConfig;
  }

  it('uses test environment config by default', function () {
    const AppConfig = loadAppConfig({
      nodeEnv: 'test',
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

  it('falls back to test config when NODE_ENV is missing', function () {
    const AppConfig = loadAppConfig({
      nodeEnv: undefined,
    });

    expect(AppConfig.appEnv).toBe('test');
    expect(AppConfig.appModuleVendorDependencies).toContain('angulartics.null');
  });

  it('registers production analytics', function () {
    const AppConfig = loadAppConfig({
      nodeEnv: 'production',
    });

    expect(AppConfig.appModuleVendorDependencies).toContain(
      'angulartics.google.analytics',
    );
    expect(AppConfig.appModuleVendorDependencies).not.toContain(
      'angulartics.debug',
    );
  });

  it('uses development analytics debug module for non-test/production env', function () {
    const AppConfig = loadAppConfig({
      nodeEnv: 'development',
    });

    expect(AppConfig.appModuleVendorDependencies).toContain(
      'angulartics.debug',
    );
    expect(AppConfig.appModuleVendorDependencies).not.toContain(
      'angulartics.google.analytics',
    );
  });

  it('does not register optional analytics modules for unknown environments', function () {
    const AppConfig = loadAppConfig({
      nodeEnv: 'staging',
    });

    expect(AppConfig.appEnv).toBe('staging');
    expect(AppConfig.appModuleVendorDependencies).not.toContain(
      'angulartics.null',
    );
    expect(AppConfig.appModuleVendorDependencies).not.toContain(
      'angulartics.debug',
    );
    expect(AppConfig.appModuleVendorDependencies).not.toContain(
      'angulartics.google.analytics',
    );
  });
});
