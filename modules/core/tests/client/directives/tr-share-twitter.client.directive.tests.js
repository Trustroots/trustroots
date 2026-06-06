import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/directives/tr-share-twitter.client.directive';

describe('trShareTwitter directive', function () {
  let $compile;
  let $rootScope;
  let $window;
  let originalGlobalTwttr;

  beforeEach(
    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $window = {
        twttr: undefined,
      };
      $provide.value('$document', angular.element(document));
      $provide.value('$window', $window);
    }),
  );

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    originalGlobalTwttr = global.twttr;
    delete global.twttr;
  }));

  afterEach(function () {
    document.querySelectorAll('#twitter-wjs').forEach(el => el.remove());
    if (typeof originalGlobalTwttr === 'undefined') {
      delete global.twttr;
    } else {
      global.twttr = originalGlobalTwttr;
    }
  });

  beforeEach(function () {
    const bootstrap = document.createElement('script');
    document.head.appendChild(bootstrap);
  });

  function compile(attrs = '') {
    const scope = $rootScope.$new();
    const element = $compile(`<div tr-share-twitter ${attrs}></div>`)(scope);
    scope.$digest();
    return { element, scope };
  }

  it('uses twitter ready path when SDK is present', function () {
    global.twttr = $window.twttr = {
      widgets: {
        load: jasmine.createSpy('load'),
      },
    };

    const { element } = compile('data-text="Hello world"');

    expect(element.html()).toContain('data-text="Hello world"');
    expect($window.twttr.widgets.load).toHaveBeenCalledWith();
  });

  it('initializes twitter sdk script when SDK is missing', function () {
    const { element } = compile();

    expect(document.getElementById('twitter-wjs')).toBeTruthy();
    expect($window.twttr).toEqual(
      jasmine.objectContaining({
        _e: jasmine.any(Array),
        ready: jasmine.any(Function),
      }),
    );
    expect(element.html()).toContain('twitter-share-button');
  });

  it('queues callbacks until the twitter sdk is ready', function () {
    const readyCallback = jasmine.createSpy('readyCallback');

    compile();
    $window.twttr.ready(readyCallback);

    expect($window.twttr._e).toEqual([readyCallback]);
  });

  it('does not inject another twitter sdk script when one already exists', function () {
    const existingScript = document.createElement('script');
    existingScript.id = 'twitter-wjs';
    document.head.appendChild(existingScript);

    compile();

    expect(document.querySelectorAll('#twitter-wjs')).toHaveLength(1);
    expect($window.twttr).toEqual({});
  });
});
