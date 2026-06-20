import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/directives/tr-time.client.directive';

describe('trTime directive', function () {
  let $compile;
  let $rootScope;
  let $log;
  let locker;

  beforeEach(function () {
    locker = {
      supported: jasmine.createSpy('locker.supported'),
      get: jasmine.createSpy('locker.get'),
      put: jasmine.createSpy('locker.put'),
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('locker', locker);
    });
  });

  beforeEach(inject(function (_$compile_, _$rootScope_, _$log_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    $log = _$log_;
  }));

  function compileTemplate(overrides = {}) {
    const scope = $rootScope.$new();
    scope.value = '2026-01-02T10:00:00Z';
    locker.supported.and.returnValue(!overrides.unsupported);
    locker.get.and.returnValue(overrides.timeModeAgo ?? true);

    const element = $compile(
      `<time tr-time="value" ${overrides.template || ''}></time>`,
    )(scope);
    scope.$digest();

    return {
      element,
      isolateScope: element.isolateScope(),
      scope,
    };
  }

  it('sets defaults for format and tooltip placement', function () {
    const { isolateScope } = compileTemplate();
    expect(isolateScope.trTimeFormat).toBe('medium');
    expect(isolateScope.tooltipPlacement).toBe('bottom');
  });

  it('hydrates sourceTime from parent scope and default rendering mode', function () {
    const { isolateScope } = compileTemplate();
    expect(isolateScope.sourceTime).toBe('2026-01-02T10:00:00Z');
    expect(isolateScope.timeModeAgo).toBe(true);
    expect(isolateScope.$parent.value).toBe('2026-01-02T10:00:00Z');
  });

  it('toggles display mode, persists to locker and broadcasts updates', function () {
    const modeChanged = jasmine.createSpy('timeModeAgoChanged');
    $rootScope.$on('timeModeAgoChanged', modeChanged);

    const { isolateScope } = compileTemplate({ timeModeAgo: true });

    isolateScope.toggleMode({
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation'),
    });

    expect(isolateScope.timeModeAgo).toBe(false);
    expect(locker.put).toHaveBeenCalledWith('timeAgo', false);
    expect(modeChanged).toHaveBeenCalledWith(jasmine.any(Object), false);
  });

  it('updates when another time component changes mode', function () {
    const { isolateScope, scope } = compileTemplate({
      timeModeAgo: false,
    });
    expect(isolateScope.timeModeAgo).toBe(false);

    scope.$broadcast('timeModeAgoChanged', true);

    expect(isolateScope.timeModeAgo).toBe(true);
  });

  it('does not read lock state from locker when unsupported', function () {
    const { isolateScope } = compileTemplate({
      timeModeAgo: false,
      unsupported: true,
    });
    locker.supported.and.returnValue(false);

    // trigger link again with current setup
    isolateScope.toggleMode({
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation'),
    });

    expect(isolateScope.timeModeAgo).toBe(false);
    expect(locker.put).not.toHaveBeenCalled();
  });

  it('warns when no time value is provided', function () {
    const scope = $rootScope.$new();
    spyOn($log, 'warn');

    $compile('<time tr-time></time>')(scope);
    scope.$digest();

    expect($log.warn).toHaveBeenCalledWith(
      'No time passed for tr-time directive.',
    );
  });
});
