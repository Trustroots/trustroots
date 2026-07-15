import '@/modules/tribes/client/tribes.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('TribeController', function () {
  let $controller;
  let $rootScope;
  let $state;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$controller_, _$rootScope_, _$state_) {
    $controller = _$controller_;
    $rootScope = _$rootScope_;
    $state = _$state_;
    spyOn($state, 'go');
  }));

  it('syncs tribe and navigates home route', function () {
    const Authentication = {
      user: { roles: ['user'] },
    };
    const Facebook = {
      isActive: true,
    };
    const vm = $controller('TribeController as vm', {
      $scope: $rootScope.$new(),
      Authentication,
      $state,
      Facebook,
      tribe: {
        _id: 'circle-id',
        slug: 'circle',
      },
    });

    vm.goBack();
    expect($state.go).toHaveBeenCalledWith('circles.list');
    expect(vm.facebookIsActibe).toBe(true);
    expect(vm.circleWikiUrl({ slug: 'punks' })).toBe(
      'https://wiki.trustroots.org/en/Punks',
    );
    expect(vm.circleWikiUrl()).toBe('');

    $rootScope.$broadcast('tribeUpdated', { slug: 'updated-circle' });
    expect(vm.tribe).toEqual({ slug: 'updated-circle' });
  });
});

describe('TribesListController', function () {
  let $controller;
  let $rootScope;

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (_$controller_, _$rootScope_) {
    $controller = _$controller_;
    $rootScope = _$rootScope_;
  }));

  it('updates Authentication user from emitted userUpdated payload', function () {
    const Authentication = { user: { _id: 'old-user' } };
    const vm = $controller('TribesListController as vm', {
      $scope: $rootScope.$new(),
      Authentication,
      $rootScope,
    });

    spyOn($rootScope, '$broadcast');

    vm.broadcastUpdatedUser({ user: { _id: 'new-user' } });

    expect(Authentication.user).toEqual({ _id: 'new-user' });
    expect($rootScope.$broadcast).toHaveBeenCalledWith('userUpdated');
  });

  it('ignores emitted updates without a user payload', function () {
    const Authentication = { user: { _id: 'old-user' } };
    const vm = $controller('TribesListController as vm', {
      $scope: $rootScope.$new(),
      Authentication,
      $rootScope,
    });

    spyOn($rootScope, '$broadcast');

    vm.broadcastUpdatedUser({});

    expect(Authentication.user).toEqual({ _id: 'old-user' });
    expect($rootScope.$broadcast).not.toHaveBeenCalled();
  });
});
