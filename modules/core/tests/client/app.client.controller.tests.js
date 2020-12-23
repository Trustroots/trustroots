import AppConfig from '@/modules/core/client/app/config';

/**
 * App client controller tests
 */
describe('App Controller Tests', function () {
  // Initialize global variables
  let $scope;
  let $state;
  let Authentication;
  let SettingsFactory;
  let Languages;

  // Load the main application module
  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (
    $controller,
    $rootScope,
    _$state_,
    _Authentication_,
    _SettingsFactory_,
    _Languages_,
  ) {
    $scope = $rootScope.$new();

    // Point global variables to injected services
    Authentication = _Authentication_;
    SettingsFactory = _SettingsFactory_;
    Languages = _Languages_;
    $state = _$state_;

    // Mock logged in user
    Authentication.user = {
      roles: ['user'],
    };

    // Mock settings
    SettingsFactory = {
      get() {
        return {};
      },
    };
    spyOn(SettingsFactory, 'get');

    // Mock languages
    Languages = {
      get() {
        return {};
      },
    };
    spyOn(Languages, 'get');

    // Spy on state go
    spyOn($state, 'go');

    // Initialize the App controller.
    $controller('AppController as vm', {
      $scope,
      SettingsFactory,
      Languages,
    });
  }));

  it('should expose app settings', function () {
    expect(SettingsFactory.get).toHaveBeenCalled();
    // expect($scope.vm.appSettings).toBeTruthy();
  });

  it('should expose languages', function () {
    expect(Languages.get).toHaveBeenCalledWith('object');
    // expect($scope.vm.languageNames).toBeTruthy();
  });

  it('should expose photo credits', function () {
    expect($scope.vm.photoCredits).toBeTruthy();
    expect($scope.vm.photoCreditsCount).toEqual(0);
  });

  it('should expose the user', function () {
    expect($scope.vm.user).toBeTruthy();
  });
});
