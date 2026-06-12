describe('Pages route config in escaped fragment mode', () => {
  afterEach(() => {
    window.history.pushState(null, '', '/');
    jest.restoreAllMocks();
  });

  it('registers a lightweight home route for SEO-rendered pages', () => {
    let registeredConfig;
    jest.spyOn(angular, 'module').mockReturnValue({
      config: callback => {
        registeredConfig = callback;
      },
    });
    window.history.pushState(null, '', '/?_escaped_fragment_=');

    jest.isolateModules(() => {
      jest.resetModules();
      require('@/modules/pages/client/config/pages.client.routes');
    });

    const $stateProvider = {
      state: jest.fn().mockReturnThis(),
    };

    registeredConfig($stateProvider);

    expect($stateProvider.state).toHaveBeenCalledWith('home', { url: '/' });
    expect($stateProvider.state).not.toHaveBeenCalledWith(
      'home',
      expect.objectContaining({
        template: expect.stringContaining('<home'),
      }),
    );
  });
});
