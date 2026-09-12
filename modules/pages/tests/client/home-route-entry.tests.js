import '@/modules/pages/client/pages.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('React home entry points', () => {
  beforeEach(angular.mock.module(AppConfig.appModuleName));
  it('preserves current and legacy circle queries and plain home links', inject((
    $state,
    $injector,
  ) => {
    const $window = { location: { assign: jest.fn() } };
    const entry = $state.get('home').onEnter;
    $injector.invoke(entry, null, {
      $window,
      $stateParams: { circle: 'sample & circle', tribe: 'legacy' },
    });
    expect($window.location.assign).toHaveBeenCalledWith(
      '/?circle=sample+%26+circle&tribe=legacy',
    );
    $injector.invoke(entry, null, { $window, $stateParams: {} });
    expect($window.location.assign).toHaveBeenLastCalledWith('/');
    $injector.invoke($state.get('safety').onEnter, null, { $window });
    expect($window.location.assign).toHaveBeenLastCalledWith('/safety');
  }));
});
