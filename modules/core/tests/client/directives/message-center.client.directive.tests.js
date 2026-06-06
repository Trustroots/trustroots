import AppConfig from '@/modules/core/client/app/config';
import '@/modules/core/client/directives/message-center.client.directive';

describe('mcMessages directive', function () {
  let $compile;
  let $rootScope;
  let messageCenterService;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (
    _$compile_,
    _$rootScope_,
    _messageCenterService_,
  ) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    messageCenterService = _messageCenterService_;
  }));

  function compile(attrs = '') {
    const element = $compile(`<div mc-messages ${attrs}></div>`)(
      $rootScope.$new(),
    );
    $rootScope.$digest();

    return element;
  }

  it('flushes messages and keeps animation default', function () {
    spyOn(messageCenterService, 'flush').and.callThrough();

    const element = compile();

    expect(messageCenterService.flush).toHaveBeenCalled();
    expect(element.scope().animation).toBe('fade in');
  });

  it('supports custom animation class', function () {
    const element = compile('animation="flash"');

    expect(element.scope().animation).toBe('flash');
  });

  it('reuses the existing location listener when compiled more than once', function () {
    spyOn($rootScope, '$on').and.callThrough();

    compile();
    compile();

    expect($rootScope.$on).toHaveBeenCalledTimes(1);
    expect(messageCenterService.offlistener).toEqual(jasmine.any(Function));
  });

  it('marks and removes shown messages after location changes', function () {
    const markShown = spyOn(
      messageCenterService,
      'markShown',
    ).and.callThrough();
    const removeShown = spyOn(
      messageCenterService,
      'removeShown',
    ).and.callThrough();
    const flush = spyOn(messageCenterService, 'flush').and.callThrough();

    compile();
    messageCenterService.add('info', 'One');
    messageCenterService.add('info', 'Two');

    $rootScope.$broadcast('$locationChangeSuccess');

    expect(markShown).toHaveBeenCalled();
    expect(removeShown).toHaveBeenCalled();
    expect(flush.calls.count()).toBeGreaterThanOrEqual(2);
  });
});
