import '@/modules/tribes/client/tribes.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('trTribeJoinButton directive', function () {
  let $compile;
  let $rootScope;
  let $q;
  let $state;
  let $confirm;
  let Authentication;
  let TribeService;
  let UserMembershipsService;
  let messageCenterService;
  let $analytics;

  beforeEach(function () {
    TribeService = {
      fillCache: jasmine.createSpy('fillCache'),
    };

    UserMembershipsService = {
      post: jasmine.createSpy('post'),
      delete: jasmine.createSpy('delete'),
    };

    $state = {
      go: jasmine.createSpy('state.go'),
      get: jasmine.createSpy('state.get').and.returnValue([]),
    };

    messageCenterService = {
      add: jasmine.createSpy('messageCenter.add'),
    };

    $confirm = jasmine.createSpy('$confirm');

    Authentication = {
      user: null,
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('TribeService', TribeService);
      $provide.value('UserMembershipsService', UserMembershipsService);
      $provide.value('$state', $state);
      $provide.value('$confirm', $confirm);
      $provide.value('Authentication', Authentication);
      $provide.value('messageCenterService', messageCenterService);
    });
  });

  beforeEach(inject(function (_$compile_, _$rootScope_, _$q_, _$analytics_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    $q = _$q_;
    $analytics = _$analytics_;

    spyOn($rootScope, '$broadcast').and.callThrough();
    spyOn($analytics, 'eventTrack');
    $confirm.and.returnValue($q.resolve());
  }));

  afterEach(function () {
    TribeService.fillCache.calls.reset();
    UserMembershipsService.post.calls.reset();
    UserMembershipsService.delete.calls.reset();
    $state.go.calls.reset();
    if ($analytics && $analytics.eventTrack && $analytics.eventTrack.calls) {
      $analytics.eventTrack.calls.reset();
    }
    messageCenterService.add.calls.reset();
    $confirm.calls.reset();
  });

  function compile(user) {
    const scope = $rootScope.$new();
    Authentication.user = user;
    scope.tribe = {
      _id: 'circle-1',
      slug: 'circle',
      label: 'Circle',
    };

    const element = $compile(
      '<button tr-tribe-join-button tribe="tribe" join-label="\'Join\'" joined-label="\'Joined\'" icon="true"></button>',
    )(scope);

    scope.$digest();

    return {
      element,
      scope,
      controller: element.isolateScope().tribeJoinButton,
    };
  }

  it('redirects to signup for anonymous users', () => {
    const { controller } = compile(null);

    controller.toggleMembership();
    $rootScope.$apply();

    expect(controller.isMember).toBe(false);
    expect(TribeService.fillCache).toHaveBeenCalledWith(
      jasmine.objectContaining({
        _id: 'circle-1',
        slug: 'circle',
        label: 'Circle',
      }),
    );
    expect($state.go).toHaveBeenCalledWith('signup', {
      tribe: 'circle',
    });
    expect(controller.isLoading).toBe(true);
  });

  it('joins tribe for signed in users and notifies analytics', () => {
    const user = {
      _id: 'user-1',
      memberIds: [],
    };

    UserMembershipsService.post.and.callFake((payload, resolve) =>
      resolve({
        tribe: {
          _id: 'circle-1',
          slug: 'circle',
          label: 'Circle',
        },
        user: {
          _id: 'user-1',
          memberIds: ['circle-1'],
        },
      }),
    );

    const { controller } = compile(user);

    controller.toggleMembership();
    $rootScope.$apply();

    expect(controller.isMember).toBe(true);
    expect(controller.isLoading).toBe(false);
    expect($state.go).not.toHaveBeenCalled();
    expect(TribeService.fillCache).not.toHaveBeenCalled();
    expect(UserMembershipsService.post).toHaveBeenCalledWith(
      { tribeId: 'circle-1' },
      jasmine.any(Function),
      jasmine.any(Function),
    );
    expect($analytics.eventTrack).toHaveBeenCalledWith('join-tribe', {
      category: 'tribes.membership',
      label: 'Join circle',
      value: 'circle',
    });
    expect(messageCenterService.add).not.toHaveBeenCalled();
    expect($rootScope.$broadcast).toHaveBeenCalledWith(
      'tribeUpdated',
      jasmine.objectContaining({ _id: 'circle-1', slug: 'circle' }),
    );
    expect($rootScope.$broadcast).toHaveBeenCalledWith('userUpdated');
  });

  it('leaves tribe after confirmation and notifies analytics', () => {
    const user = {
      _id: 'user-1',
      memberIds: ['circle-1'],
    };

    UserMembershipsService.delete.and.callFake((payload, resolve) =>
      resolve({
        tribe: {
          _id: 'circle-1',
          slug: 'circle',
          label: 'Circle',
        },
        user: {
          _id: 'user-1',
          memberIds: [],
        },
      }),
    );

    const { controller } = compile(user);

    expect(controller.isMember).toBe(true);

    controller.toggleMembership();
    $rootScope.$apply();

    expect(controller.isMember).toBe(false);
    expect(controller.isLoading).toBe(false);
    expect(UserMembershipsService.delete).toHaveBeenCalledWith(
      { tribeId: 'circle-1' },
      jasmine.any(Function),
      jasmine.any(Function),
    );
    expect($analytics.eventTrack).toHaveBeenCalledWith('leave-tribe', {
      category: 'tribes.membership',
      label: 'Leave circle',
      value: 'circle',
    });
  });

  it('tracks cancelled leave and resets loading', () => {
    const user = {
      _id: 'user-1',
      memberIds: ['circle-1'],
    };
    const confirmDeferred = $q.defer();

    $confirm.and.returnValue(confirmDeferred.promise);

    const { controller } = compile(user);

    controller.toggleMembership();
    confirmDeferred.reject('cancelled');
    $rootScope.$apply();

    expect(controller.isMember).toBe(true);
    expect(controller.isLoading).toBe(false);
    expect(UserMembershipsService.delete).not.toHaveBeenCalled();
    expect(messageCenterService.add).not.toHaveBeenCalled();
    expect($analytics.eventTrack).toHaveBeenCalledWith(
      'leave-tribe-cancelled',
      {
        category: 'tribes.membership',
        label: 'Leaving circle cancelled',
        value: 'circle',
      },
    );
  });

  it('shows a failure message when leaving request fails', () => {
    const user = {
      _id: 'user-1',
      memberIds: ['circle-1'],
    };

    UserMembershipsService.delete.and.callFake((payload, resolve, reject) =>
      reject({
        data: {
          message: 'Nope',
        },
      }),
    );

    const { controller } = compile(user);

    controller.toggleMembership();
    $rootScope.$apply();

    expect(controller.isMember).toBe(true);
    expect(messageCenterService.add).toHaveBeenCalledWith('danger', 'Nope');
    expect($analytics.eventTrack).not.toHaveBeenCalledWith(
      'leave-tribe',
      jasmine.anything(),
    );
  });

  it('ignores click while already loading', () => {
    const { controller } = compile({
      _id: 'user-1',
      memberIds: [],
    });

    controller.isLoading = true;
    controller.toggleMembership();
    $rootScope.$apply();

    expect(UserMembershipsService.post).not.toHaveBeenCalled();
    expect(controller.isLoading).toBe(true);
  });
});
