import '@/modules/users/client/users.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('React recovery entry points', () => {
  beforeEach(angular.mock.module(AppConfig.appModuleName));
  it('preserves recovery prefill and the outcome destinations', inject((
    $state,
    $injector,
  ) => {
    const $window = { location: { assign: jest.fn() } };
    for (const [state, path] of [
      ['forgot', '/password/forgot'],
      ['reset-success', '/password/reset/success'],
      ['reset-invalid', '/password/reset/invalid'],
      ['confirm-email-invalid', '/confirm-email-invalid'],
    ]) {
      $injector.invoke($state.get(state).onEnter, null, {
        $window,
        $stateParams: {},
      });
      expect($window.location.assign).toHaveBeenLastCalledWith(path);
    }
    $injector.invoke($state.get('forgot').onEnter, null, {
      $window,
      $stateParams: { userhandle: 'sample+member@example.test' },
    });
    expect($window.location.assign).toHaveBeenLastCalledWith(
      '/password/forgot?userhandle=sample%2Bmember%40example.test',
    );
  }));
});
