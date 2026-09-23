import '@/modules/users/client/users.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('Profile view route handover', function () {
  beforeEach(angular.mock.module(AppConfig.appModuleName));
  beforeEach(
    angular.mock.module(function ($urlRouterProvider) {
      $urlRouterProvider.deferIntercept();
    }),
  );

  it('opens each read-only view in the React shell', inject(function (
    $state,
    $injector,
  ) {
    const states = [
      ['profile.about', ''],
      ['profile.overview', '/overview'],
      ['profile.accommodation', '/accommodation'],
      ['profile.contacts', '/contacts'],
      ['profile.tribes', '/tribes'],
      ['profile.experiences.list', '/experiences'],
    ];
    const assign = jest.fn();

    for (const [state, suffix] of states) {
      $injector.invoke($state.get(state).onEnter, null, {
        $window: { location: { assign } },
        $stateParams: { username: 'sample member' },
      });
      expect(assign).toHaveBeenLastCalledWith(
        `/profile/sample%20member${suffix}`,
      );
    }
  }));

  it('leaves experience writing in Angular', inject(function ($state) {
    expect($state.get('profile.experiences.new').onEnter).toBeUndefined();
    expect($state.get('profile-edit.about').onEnter).toBeUndefined();
  }));
});
