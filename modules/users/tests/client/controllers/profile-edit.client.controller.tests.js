import AppConfig from '@/modules/core/client/app/config';
import '@/modules/users/client/users.client.module';

describe('ProfileEditController', function () {
  let $controller;
  let $rootScope;
  let $q;
  let $state;
  let $confirm;
  let confirmation;

  beforeEach(function () {
    $state = {
      go: jasmine.createSpy('go'),
      get: jasmine.createSpy('get').and.returnValue([]),
    };

    $confirm = jasmine.createSpy('$confirm').and.callFake(function () {
      confirmation = $q.defer();
      return confirmation.promise;
    });

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('$state', $state);
      $provide.value('$confirm', $confirm);
    });
  });

  beforeEach(inject(function (_$controller_, _$rootScope_, _$q_) {
    $controller = _$controller_;
    $rootScope = _$rootScope_;
    $q = _$q_;
  }));

  function createController() {
    const $scope = $rootScope.$new();

    return {
      $scope,
      vm: $controller('ProfileEditController', {
        $scope,
      }),
    };
  }

  it('marks unsaved changes on userChanged', function () {
    const { vm, $scope } = createController();

    $scope.$broadcast('userChanged');

    expect(vm.unsavedModifications).toBe(true);
  });

  it('resets unsaved changes on userUpdated', function () {
    const { vm, $scope } = createController();

    vm.unsavedModifications = true;
    $scope.$broadcast('userUpdated');

    expect(vm.unsavedModifications).toBe(false);
  });

  it('prevents state transition and asks for confirmation', function () {
    const { vm, $scope } = createController();
    vm.unsavedModifications = true;

    const event = $scope.$broadcast(
      '$stateChangeStart',
      {
        name: 'profile.edit',
      },
      {
        tab: 'networks',
      },
    );

    expect(event.defaultPrevented).toBe(true);
    expect($confirm).toHaveBeenCalledWith({
      title: 'Are you sure?',
      text: 'Your changes would be lost. Return and press "Save" to keep the changes, or press "Continue" to discard them.',
      ok: 'Continue',
      cancel: 'Cancel',
    });

    confirmation.resolve();
    $rootScope.$apply();

    expect(vm.unsavedModifications).toBe(false);
    expect($state.go).toHaveBeenCalledWith('profile.edit', {
      tab: 'networks',
    });
  });

  it('does not block state changes when there are no unsaved changes', function () {
    const { vm, $scope } = createController();

    vm.unsavedModifications = false;
    const event = $scope.$broadcast(
      '$stateChangeStart',
      { name: 'profile.view' },
      {},
    );

    expect(event.defaultPrevented).toBe(false);
    expect($confirm).not.toHaveBeenCalled();
    expect($state.go).not.toHaveBeenCalled();
  });
});
