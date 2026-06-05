import '@/modules/users/client/users.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('ProfileEditAboutController', function () {
  let $controller;
  let $rootScope;
  let $state;
  let Authentication;
  let messageCenterService;
  let Users;
  let usersUpdateResult;
  let usersUpdateError;

  const initialUser = {
    _id: 'user-1',
    username: 'traveller',
    email: 'traveller@example.org',
  };

  beforeEach(function () {
    usersUpdateResult = {
      ...initialUser,
      description: 'Updated profile text',
    };
    usersUpdateError = null;

    messageCenterService = {
      add: jasmine.createSpy('messageCenterService.add'),
    };

    const $stateMock = {
      href: jasmine
        .createSpy('$state.href')
        .and.returnValue('https://trustroots.org/profile/traveller'),
      get: jasmine.createSpy('$state.get').and.returnValue([]),
    };

    Users = function UsersMock(user) {
      const model = {
        ...user,
      };

      model.$update = jasmine
        .createSpy('$update')
        .and.callFake(function (successCallback, errorCallback) {
          if (usersUpdateError) {
            errorCallback(usersUpdateError);
          } else {
            successCallback(usersUpdateResult);
          }
        });

      return model;
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('$state', $stateMock);
      $provide.value('Users', Users);
      $provide.value('messageCenterService', messageCenterService);
    });
  });

  beforeEach(inject(function (
    _$controller_,
    _$rootScope_,
    _$state_,
    _Authentication_,
  ) {
    $controller = _$controller_;
    $rootScope = _$rootScope_;
    $state = _$state_;
    Authentication = _Authentication_;
  }));

  function createController() {
    const $scope = $rootScope.$new();
    spyOn($scope, '$emit').and.callThrough();
    Authentication.user = { ...initialUser };

    const vm = $controller('ProfileEditAboutController', {
      $scope,
      $state,
      Authentication,
    });

    return {
      vm,
      $scope,
    };
  }

  it('creates an about-page share URL with strong username highlight', function () {
    const { vm } = createController();

    expect(vm.profileURL).toBe(
      'trustroots.org/profile/<strong>traveller</strong>',
    );
  });

  it('updates in-memory languages on language change', function () {
    const { vm } = createController();

    vm.onChangeLanguages(['en', 'fi']);

    expect(vm.user.languages).toEqual(['en', 'fi']);
  });

  it('calls users API and updates auth user on valid submit', function () {
    const { vm, $scope } = createController();
    vm.user.description = 'Updated profile text';

    vm.updateUserProfile(true);

    expect(Authentication.user).toEqual({
      ...usersUpdateResult,
    });
    expect(vm.user).toEqual(
      expect.objectContaining({ description: 'Updated profile text' }),
    );
    expect($state.href).toHaveBeenCalledWith(
      'profile',
      { username: 'traveller' },
      { absolute: true },
    );
    expect($scope.$emit).toHaveBeenCalledWith('userUpdated');
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'success',
      'Profile updated.',
    );
  });

  it('shows validation error when form is invalid', function () {
    const { vm } = createController();

    vm.updateUserProfile(false);

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Please fix errors from your profile and try again.',
      { timeout: 10000 },
    );
  });

  it('shows server side error message when update fails', function () {
    const { vm } = createController();
    usersUpdateError = { data: { message: 'Update failed.' } };

    vm.updateUserProfile(true);

    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Update failed.',
      { timeout: 10000 },
    );
  });
});
