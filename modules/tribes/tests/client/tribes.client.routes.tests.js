import '@/modules/tribes/client/tribes.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('Circle route handover', function () {
  beforeEach(angular.mock.module(AppConfig.appModuleName));
  beforeEach(
    angular.mock.module(function ($urlRouterProvider) {
      $urlRouterProvider.deferIntercept();
    }),
  );

  it('keeps the legacy state names for links from Angular pages', inject(function (
    $state,
  ) {
    expect($state.get('circles').abstract).toBe(true);
    expect($state.get('circles').url).toBe('/circles');
    expect($state.get('circles.list').url).toBe('');
    expect($state.get('circles.circle').url).toBe('/:circle');
  }));

  it('opens the React catalogue from the list state', inject(function (
    $state,
    $injector,
  ) {
    const assign = jest.fn();
    $injector.invoke($state.get('circles.list').onEnter, null, {
      $window: { location: { assign } },
      $stateParams: {},
    });
    expect(assign).toHaveBeenCalledWith('/circles');
  }));

  it('encodes the circle slug when handing over a detail route', inject(function (
    $state,
    $injector,
  ) {
    const assign = jest.fn();
    $injector.invoke($state.get('circles.circle').onEnter, null, {
      $window: { location: { assign } },
      $stateParams: { circle: 'sample/circle' },
    });
    expect(assign).toHaveBeenCalledWith('/circles/sample%2Fcircle');
  }));
});
