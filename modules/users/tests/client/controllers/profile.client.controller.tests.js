import '@/modules/users/client/users.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('ProfileController', function () {
  let $controller;
  let $rootScope;
  let $state;
  let $stateParams;
  let $filter;
  let $timeout;
  let Authentication;

  let bodyWidth;
  let originalAngularElement;

  const viewer = {
    _id: 'viewer-id',
    username: 'viewer',
    description: '<b>Viewer profile</b>',
  };

  beforeEach(function () {
    bodyWidth = 1024;
    originalAngularElement = angular.element;

    spyOn(angular, 'element').and.callFake(function (selector) {
      if (selector === 'body') {
        return {
          width: () => bodyWidth,
        };
      }

      return originalAngularElement(selector);
    });
  });

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (
    _$controller_,
    _$rootScope_,
    _$state_,
    _$stateParams_,
    _$filter_,
    _$timeout_,
    _Authentication_,
  ) {
    $controller = _$controller_;
    $rootScope = _$rootScope_;
    $state = _$state_;
    $stateParams = _$stateParams_;
    $filter = _$filter_;
    $timeout = _$timeout_;
    Authentication = _Authentication_;

    spyOn($state, 'go').and.callThrough();
  }));

  afterEach(function () {
    angular.element = originalAngularElement;
  });

  function createController({
    profile = {
      _id: 'member-id',
      username: 'member',
      description: '<p>Hello</p>',
    },
    contact = { _id: 'contact-1' },
    contacts = [{ _id: 'contact-1' }],
    stateParams = { username: 'member' },
    stateName = 'profile.about',
  } = {}) {
    $state.current.name = stateName;
    $stateParams.username = stateParams.username;
    Authentication.user = viewer;

    const scope = $rootScope.$new();
    return $controller('ProfileController as profileCtrl', {
      $scope: scope,
      $state,
      $stateParams,
      $filter,
      Authentication,
      profile,
      contact,
      contacts,
    });
  }

  it('redirects to own profile when username is missing', function () {
    const vm = createController({
      stateParams: {},
    });

    expect(vm).toBeDefined();
    expect($state.go).toHaveBeenCalledWith('profile.about', {
      username: 'viewer',
    });
  });

  it('redirects small screens from profile about to overview', function () {
    bodyWidth = 320;

    createController();
    expect($state.go).not.toHaveBeenCalled();

    $timeout.flush(25);

    expect($state.go).toHaveBeenCalledWith('profile.overview', {
      username: 'member',
    });
  });

  it('redirects desktop profile overview to about', function () {
    createController({
      stateName: 'profile.overview',
    });

    expect($state.go).toHaveBeenCalledWith('profile.about', {
      username: 'member',
    });
  });

  it('computes profileDescriptionLength for own profile', function () {
    const vm = createController({
      profile: {
        _id: 'viewer-id',
        username: 'viewer',
        description: '<b>Hello</b> <i>world</i>',
      },
    });

    expect(vm.profileDescriptionLength).toBe(14);
  });

  it('removes matching contact from profile contact list and metadata', function () {
    const contact = {
      _id: 'contact-keep',
      displayName: 'Contact',
    };
    const other = {
      _id: 'contact-other',
    };
    const vm = createController({
      contacts: [contact, other],
      contact,
    });

    vm.removeContact(contact);

    expect(vm.contacts).toEqual([other]);
    expect(contact._id).toBeUndefined();
  });

  it('does not mutate contact list when removing an unknown contact', function () {
    const contact = {
      _id: 'contact-keep',
      displayName: 'Contact',
    };
    const other = {
      _id: 'contact-other',
    };
    const missing = {
      _id: 'ghost',
    };
    const vm = createController({
      contacts: [contact, other],
      contact,
    });

    vm.removeContact(missing);

    expect(vm.contacts).toEqual([contact, other]);
    expect(contact._id).toBe('contact-keep');
  });

  it('removes contact id when a contactRemoved broadcast matches current contact', function () {
    const contact = {
      _id: 'to-remove',
    };

    createController({
      contact,
    });

    $rootScope.$broadcast('contactRemoved', contact);

    expect(contact._id).toBeUndefined();
  });

  it('does not clear current contact when another contact was removed', function () {
    const contact = {
      _id: 'to-keep',
      displayName: 'Keep Me',
    };
    const other = {
      _id: 'different',
    };

    createController({
      contact,
    });

    $rootScope.$broadcast('contactRemoved', other);

    expect(contact._id).toBe('to-keep');
  });
});
