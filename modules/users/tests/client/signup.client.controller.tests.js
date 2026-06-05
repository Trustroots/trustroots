import '@/modules/users/client/users.client.module';
import '@/modules/search/client/search.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('SignupController', function () {
  let $controller;
  let $httpBackend;
  let $q;
  let $rootScope;
  let Authentication;

  const suggestedTribes = [
    { _id: 'hitchhikers', label: 'Hitchhikers' },
    { _id: 'cyclists', label: 'Cyclists' },
    { _id: 'families', label: 'Families' },
  ];

  beforeEach(angular.mock.module(AppConfig.appModuleName));

  beforeEach(inject(function (
    _$controller_,
    _$httpBackend_,
    _$q_,
    _$rootScope_,
    _Authentication_,
  ) {
    $controller = _$controller_;
    $httpBackend = _$httpBackend_;
    $q = _$q_;
    $rootScope = _$rootScope_;
    Authentication = _Authentication_;

    Authentication.user = null;
    spyOn($rootScope, '$broadcast').and.callThrough();
  }));

  afterEach(function () {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  function createController(options = {}) {
    const $analytics = {
      eventTrack: jasmine.createSpy('$analytics.eventTrack'),
    };
    const $state = {
      go: jasmine.createSpy('$state.go'),
    };
    const $stateParams = options.stateParams || {};
    const $uibModal = {
      open: jasmine.createSpy('$uibModal.open'),
    };
    const messageCenterService = {
      add: jasmine.createSpy('messageCenterService.add'),
    };
    const UserMembershipsService = {
      post: jasmine
        .createSpy('UserMembershipsService.post')
        .and.callFake(function (_params, callback) {
          callback({
            user: options.membershipUser || { _id: 'joined-user' },
          });
        }),
    };
    const TribeService = {
      get: jasmine.createSpy('TribeService.get').and.callFake(function () {
        return $q.resolve(options.referredTribe || {});
      }),
    };
    const TribesService = {
      query: jasmine
        .createSpy('TribesService.query')
        .and.callFake(function (_params, callback) {
          callback(options.suggestedTribes || suggestedTribes);
        }),
    };

    const controller = $controller('SignupController', {
      $analytics,
      $state,
      $stateParams,
      $uibModal,
      Authentication,
      messageCenterService,
      TribeService,
      TribesService,
      UserMembershipsService,
    });

    return {
      $analytics,
      $state,
      $uibModal,
      controller,
      messageCenterService,
      TribeService,
      TribesService,
      UserMembershipsService,
    };
  }

  it('redirects already authenticated users to the map', function () {
    Authentication.user = { _id: 'user' };

    const { $state, TribesService } = createController();

    expect($state.go).toHaveBeenCalledWith('search.map');
    expect(TribesService.query).not.toHaveBeenCalled();
  });

  it('loads suggested tribes for new users', function () {
    const { controller, TribesService } = createController();

    expect(TribesService.query).toHaveBeenCalledWith(
      { limit: 40 },
      jasmine.any(Function),
    );
    expect(controller.tribe).toBeNull();
    expect(controller.suggestedTribes).toHaveLength(suggestedTribes.length);
    expect(controller.suggestedTribes).toEqual(
      expect.arrayContaining(suggestedTribes),
    );
  });

  it('loads a referred tribe and removes it from suggestions', function () {
    const referredTribe = suggestedTribes[0];
    const { controller, TribeService, TribesService } = createController({
      referredTribe,
      stateParams: { tribe: 'hitchhikers' },
    });

    expect(TribeService.get).toHaveBeenCalledWith({
      tribeSlug: 'hitchhikers',
    });
    expect(TribesService.query).not.toHaveBeenCalled();

    $rootScope.$digest();

    expect(controller.tribe).toBe(referredTribe);
    expect(TribesService.query).toHaveBeenCalledWith(
      { limit: 40 },
      jasmine.any(Function),
    );
    expect(controller.suggestedTribes).toHaveLength(2);
    expect(controller.suggestedTribes).toEqual(
      expect.arrayContaining([suggestedTribes[1], suggestedTribes[2]]),
    );
    expect(controller.suggestedTribes).not.toContain(referredTribe);
  });

  describe('getUsernameValidationError', function () {
    it('returns no message for untouched or valid username fields', function () {
      const { controller } = createController();

      expect(controller.getUsernameValidationError()).toBe('');
      expect(
        controller.getUsernameValidationError({
          $dirty: false,
          $valid: false,
        }),
      ).toBe('');
      expect(
        controller.getUsernameValidationError({
          $dirty: true,
          $valid: true,
        }),
      ).toBe('');
    });

    it('returns the most specific username validation message', function () {
      const { controller } = createController();

      expect(
        controller.getUsernameValidationError({
          $dirty: true,
          $error: { required: true },
          $valid: false,
        }),
      ).toBe('Username is required.');
      expect(
        controller.getUsernameValidationError({
          $dirty: true,
          $error: { maxlength: true },
          $valid: false,
        }),
      ).toBe('Too long, maximum length is 34 characters.');
      expect(
        controller.getUsernameValidationError({
          $dirty: true,
          $error: { minlength: true },
          $valid: false,
        }),
      ).toBe('Too short, minumum length is 3 characters.');
      expect(
        controller.getUsernameValidationError({
          $dirty: true,
          $error: { pattern: true },
          $valid: false,
        }),
      ).toBe('Invalid username.');
      expect(
        controller.getUsernameValidationError({
          $dirty: true,
          $error: { username: true },
          $valid: false,
        }),
      ).toBe('This username is already in use.');
      expect(
        controller.getUsernameValidationError({
          $dirty: true,
          $error: {},
          $valid: false,
        }),
      ).toBe('Invalid username.');
    });
  });

  it('moves to circle selection after a successful signup', function () {
    const newUser = { _id: 'new-user', username: 'newuser' };
    const { controller, UserMembershipsService } = createController();
    controller.credentials = {
      email: 'new@example.com',
      password: 'abcdefgh',
      username: 'newuser',
    };

    $httpBackend
      .expectPOST('/api/auth/signup', controller.credentials)
      .respond(200, newUser);
    controller.submitSignup();
    expect(controller.isLoading).toBe(true);
    $httpBackend.flush();

    expect(UserMembershipsService.post).not.toHaveBeenCalled();
    expect(Authentication.user).toEqual(newUser);
    expect($rootScope.$broadcast).toHaveBeenCalledWith('userUpdated');
    expect(controller.isLoading).toBe(false);
    expect(controller.step).toBe(2);
  });

  it('joins a referred tribe after signup before moving to circle selection', function () {
    const referredTribe = suggestedTribes[0];
    const joinedUser = { _id: 'joined-user', username: 'joineduser' };
    const { controller, UserMembershipsService } = createController({
      membershipUser: joinedUser,
      referredTribe,
      stateParams: { tribe: 'hitchhikers' },
    });
    $rootScope.$digest();

    $httpBackend
      .expectPOST('/api/auth/signup')
      .respond(200, { _id: 'new-user' });
    controller.submitSignup();
    $httpBackend.flush();

    expect(UserMembershipsService.post).toHaveBeenCalledWith(
      { tribeId: referredTribe._id },
      jasmine.any(Function),
    );
    expect(Authentication.user).toEqual(joinedUser);
    expect(controller.isLoading).toBe(false);
    expect(controller.step).toBe(2);
  });

  it('marks duplicate email errors without showing a generic flash', function () {
    const { controller, messageCenterService } = createController();

    $httpBackend.expectPOST('/api/auth/signup').respond(400, {
      message: 'Account with this email exists already.',
    });
    controller.submitSignup();
    $httpBackend.flush();

    expect(controller.isLoading).toBe(false);
    expect(controller.isEmailTaken).toBe(true);
    expect(messageCenterService.add).not.toHaveBeenCalled();
  });

  it('shows a fallback message when signup fails without a server message', function () {
    const { controller, messageCenterService } = createController();

    $httpBackend.expectPOST('/api/auth/signup').respond(500);
    controller.submitSignup();
    $httpBackend.flush();

    expect(controller.isLoading).toBe(false);
    expect(messageCenterService.add).toHaveBeenCalledWith(
      'danger',
      'Something went wrong while signing you up. Try again!',
    );
  });

  it('opens the rules modal and records the analytics event', function () {
    const { $analytics, $uibModal, controller } = createController();
    const event = {
      preventDefault: jasmine.createSpy('preventDefault'),
    };

    controller.openRules(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect($uibModal.open).toHaveBeenCalledWith({
      templateUrl: expect.stringContaining('rules-modal.client.view.html'),
    });
    expect($analytics.eventTrack).toHaveBeenCalledWith('signup.rules.open', {
      category: 'signup',
      label: 'Open rules from signup form',
    });
  });
});
