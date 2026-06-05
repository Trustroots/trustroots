import AppConfig from '@/modules/core/client/app/config';

describe('Facebook service', function () {
  let $document;
  let $httpBackend;
  let $rootScope;
  let Authentication;
  let Facebook;
  let statusChangeCallback;

  beforeEach(function () {
    const existingScript = document.getElementById('facebook-jssdk');
    if (existingScript) {
      existingScript.remove();
    }

    statusChangeCallback = undefined;
    delete window.FB;
    window.fbAsyncInit = undefined;
    window.facebookAppId = '';
  });

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (
    _$document_,
    _$httpBackend_,
    _$rootScope_,
    _Authentication_,
    _Facebook_,
  ) {
    $document = _$document_;
    $httpBackend = _$httpBackend_;
    $rootScope = _$rootScope_;
    Authentication = _Authentication_;
    Facebook = _Facebook_;
  }));

  afterEach(function () {
    const injectedScript = document.getElementById('facebook-jssdk');
    if (injectedScript) {
      injectedScript.remove();
    }

    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
    delete window.FB;
  });

  function mockFacebook() {
    window.FB = {
      init: jest.fn(),
      Event: {
        subscribe: jest.fn((_, callback) => {
          statusChangeCallback = callback;
        }),
      },
    };
  }

  it('skips init if no Facebook app id is configured', function () {
    mockFacebook();
    Authentication.user = {
      additionalProvidersData: { facebook: { id: 'fb-user-id' } },
    };

    Facebook.init();

    expect(window.FB.init).not.toHaveBeenCalled();
    expect(window.fbAsyncInit).toBeUndefined();
  });

  it('skips init when user is missing Facebook provider data', function () {
    mockFacebook();
    window.facebookAppId = 'fb-app-id';
    Authentication.user = {};

    Facebook.init();

    expect(window.FB.init).not.toHaveBeenCalled();
    expect(window.fbAsyncInit).toBeUndefined();
  });

  it('injects the SDK script and exposes fbAsyncInit when ready', function () {
    mockFacebook();
    window.facebookAppId = 'fb-app-id';
    Authentication.user = {
      additionalProvidersData: { facebook: { id: 'fb-user-id' } },
    };

    // `getElementsByTagName('script')[0]` needs a reference point.
    const anchorScript = document.createElement('script');
    $document[0].head.appendChild(anchorScript);

    Facebook.init();

    expect(window.fbAsyncInit).toBeDefined();
    expect(window.document.getElementById('facebook-jssdk')).toBeTruthy();
    expect(window.document.getElementById('facebook-jssdk').src).toContain(
      '//connect.facebook.net/en_US/sdk.js',
    );
    expect(window.FB.init).not.toHaveBeenCalled();
  });

  it('broadcasts facebook ready and stores token when status becomes connected', function () {
    const anchorScript = document.createElement('script');
    $document[0].head.appendChild(anchorScript);

    mockFacebook();
    window.facebookAppId = 'fb-app-id';
    Authentication.user = {
      additionalProvidersData: { facebook: { id: 'fb-user-id' } },
    };

    $httpBackend
      .expectPUT('/api/auth/facebook', {
        accessToken: 'token',
        expiresIn: 1800,
        signedRequest: 'sr',
        userID: '12345',
      })
      .respond(200, {});

    Facebook.init();
    window.fbAsyncInit();

    expect(window.FB.init).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: 'fb-app-id',
      }),
    );
    expect(statusChangeCallback).toBeDefined();

    statusChangeCallback({
      status: 'connected',
      authResponse: {
        accessToken: 'token',
        expiresIn: 1800,
        signedRequest: 'sr',
        userID: '12345',
      },
    });

    $httpBackend.flush();
    $rootScope.$apply();
    expect(window.FB.Event.subscribe).toHaveBeenCalledWith(
      'auth.statusChange',
      statusChangeCallback,
    );
  });

  it('ignores non-connected Facebook status updates', function () {
    const anchorScript = document.createElement('script');
    $document[0].head.appendChild(anchorScript);

    mockFacebook();
    window.facebookAppId = 'fb-app-id';
    Authentication.user = {
      additionalProvidersData: { facebook: { id: 'fb-user-id' } },
    };

    Facebook.init();
    window.fbAsyncInit();
    expect(statusChangeCallback).toBeDefined();

    statusChangeCallback({
      status: 'not_authorized',
    });

    $rootScope.$apply();
  });
});
