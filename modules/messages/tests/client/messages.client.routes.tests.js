import '@/modules/messages/client/messages.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('Messaging route handover', function () {
  beforeEach(angular.mock.module(AppConfig.appModuleName));
  beforeEach(
    angular.mock.module(function ($urlRouterProvider) {
      $urlRouterProvider.deferIntercept();
    }),
  );

  it('retains the inbox and thread state names for Angular links', inject(function (
    $state,
  ) {
    expect($state.get('inbox').url).toBe('/messages');
    expect($state.get('messageThread').url).toBe('/messages/:username?userId');
  }));

  it('opens the React inbox from its named state', inject(function (
    $state,
    $injector,
  ) {
    const assign = jest.fn();
    $injector.invoke($state.get('inbox').onEnter, null, {
      $window: { location: { assign } },
    });
    expect(assign).toHaveBeenCalledWith('/messages');
  }));

  it('opens a thread while preserving the deleted-member ID', inject(function (
    $state,
    $injector,
  ) {
    const assign = jest.fn();
    const $window = { location: { origin: 'https://example.test', assign } };

    $injector.invoke($state.get('messageThread').onEnter, null, {
      $window,
      $stateParams: { username: 'sample member', userId: 'member-1' },
    });
    expect(assign).toHaveBeenCalledWith(
      '/messages/sample%20member?userId=member-1',
    );

    $injector.invoke($state.get('messageThread').onEnter, null, {
      $window,
      $stateParams: { username: 'alice' },
    });
    expect(assign).toHaveBeenLastCalledWith('/messages/alice');
  }));
});
