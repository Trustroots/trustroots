import '@/modules/search/client/search.client.module';
import AppConfig from '@/modules/core/client/app/config';

describe('Search filter toggle directives', function () {
  let $compile;
  let $q;
  let $rootScope;
  let TribesService;
  let UserMembershipsService;
  let userMemberships;
  const tribes = [
    {
      _id: 'cyclists',
      label: 'Cyclists',
    },
    {
      _id: 'families',
      label: 'Families',
    },
  ];

  beforeEach(function () {
    userMemberships = [
      {
        tribe: {
          _id: 'cyclists',
        },
      },
      {
        tribe: {
          _id: 'families',
        },
      },
    ];
    TribesService = {
      query: jasmine.createSpy('TribesService.query').and.returnValue(tribes),
    };
    UserMembershipsService = {
      query: jasmine.createSpy('UserMembershipsService.query'),
    };

    angular.mock.module(AppConfig.appModuleName, function ($provide) {
      $provide.value('TribesService', TribesService);
      $provide.value('UserMembershipsService', UserMembershipsService);
    });
  });

  beforeEach(inject(function (_$compile_, _$q_, _$rootScope_) {
    $compile = _$compile_;
    $q = _$q_;
    $rootScope = _$rootScope_;

    UserMembershipsService.query.and.callFake(function () {
      return {
        $promise: $q.resolve(userMemberships),
      };
    });
  }));

  function compileDirective(template, scopeValues) {
    const scope = $rootScope.$new();
    angular.extend(scope, scopeValues);
    const element = $compile(template)(scope);
    scope.$digest();

    return {
      controller:
        element.isolateScope().trTypesToggle ||
        element.isolateScope().trTribesToggle ||
        element.isolateScope().myTribesToggle,
      element,
      isolateScope: element.isolateScope(),
      scope,
    };
  }

  it('normalizes a cached host-only filter to include meetups', function () {
    const { controller, scope } = compileDirective(
      '<div tr-types-toggle="types"></div>',
      {
        types: ['host'],
      },
    );

    expect(controller.toggles).toEqual({
      host: true,
    });
    expect(scope.types).toEqual(['host', 'meet']);
  });

  it('normalizes a missing offer filter to meetups', function () {
    const { controller, scope } = compileDirective(
      '<div tr-types-toggle="types"></div>',
      {},
    );

    expect(controller.toggles).toEqual({ host: false });
    expect(scope.types).toEqual(['meet']);
  });

  it('keeps meetups published when Hosts is turned off', function () {
    const { controller, scope } = compileDirective(
      '<div tr-types-toggle="types"></div>',
      {
        types: ['host', 'meet'],
      },
    );

    controller.toggles.host = false;
    controller.onToggleChange();
    scope.$digest();

    expect(scope.types).toEqual(['meet']);
  });

  it('keeps offer type filters synchronized with toggles', function () {
    const { controller, scope } = compileDirective(
      '<div tr-types-toggle="types"></div>',
      {
        types: ['host', 'meet'],
      },
    );

    expect(controller.types).toEqual([
      jasmine.objectContaining({
        id: 'host',
        label: 'Hosts',
      }),
    ]);

    scope.types = [];
    scope.$digest();

    expect(controller.toggles).toEqual({
      host: false,
    });
    expect(scope.types).toEqual(['meet']);
  });

  it('accepts object-backed offer type filters from outside the directive', function () {
    const { controller, scope } = compileDirective(
      '<div tr-types-toggle="types"></div>',
      {
        types: [],
      },
    );

    expect(controller.toggles).toEqual({
      host: false,
    });
    expect(scope.types).toEqual(['meet']);

    scope.types = [{ id: 'host' }, { id: 'meet' }];
    scope.$digest();

    expect(controller.toggles).toEqual({
      host: true,
    });
    expect(scope.types).toEqual(['host', 'meet']);
  });

  it('keeps tribe filters synchronized with toggles', function () {
    const { controller, scope } = compileDirective(
      '<div tr-tribes-toggle="tribeIds"></div>',
      {
        tribeIds: ['cyclists'],
      },
    );

    expect(TribesService.query).toHaveBeenCalled();
    expect(controller.tribes).toBe(tribes);
    expect(controller.toggles).toEqual({
      cyclists: true,
    });

    controller.toggles = {
      cyclists: false,
      families: true,
    };
    controller.onToggleChange();
    scope.$digest();

    expect(scope.tribeIds).toEqual(['families']);

    scope.tribeIds = ['cyclists', 'families'];
    scope.$digest();

    expect(controller.toggles).toEqual({
      cyclists: true,
      families: true,
    });
  });

  it('keeps tribe toggles empty when no tribe filters are selected', function () {
    const { controller, scope } = compileDirective(
      '<div tr-tribes-toggle="tribeIds"></div>',
      {
        tribeIds: [],
      },
    );

    expect(controller.toggles).toEqual({});

    scope.tribeIds = ['cyclists'];
    scope.$digest();
    expect(controller.toggles).toEqual({
      cyclists: true,
    });

    scope.tribeIds = [];
    scope.$digest();
    expect(controller.toggles).toEqual({});
  });

  it('can replace tribe filters with the current member circles', function () {
    const { controller, scope } = compileDirective(
      '<div tr-my-tribes-toggle="tribeIds"></div>',
      {
        tribeIds: [],
      },
    );

    $rootScope.$digest();

    expect(UserMembershipsService.query).toHaveBeenCalled();
    expect(controller.initialized).toBe(true);
    expect(controller.userTribes).toEqual(['cyclists', 'families']);

    controller.toggle = true;
    controller.onChange();
    scope.$digest();

    expect(scope.tribeIds).toEqual(['cyclists', 'families']);

    scope.$digest();
    scope.tribeIds = ['nomads'];
    scope.$digest();

    expect(controller.toggle).toBe(false);
  });

  it('initializes my-circle filtering without memberships', function () {
    userMemberships = [];

    const { controller, scope } = compileDirective(
      '<div tr-my-tribes-toggle="tribeIds"></div>',
      {
        tribeIds: [],
      },
    );

    $rootScope.$digest();
    controller.toggle = true;
    controller.onChange();

    expect(controller.initialized).toBe(true);
    expect(controller.userTribes).toEqual([]);
    expect(scope.tribeIds).toEqual([]);
  });

  it('does not replace tribe filters when my-circle toggle is off', function () {
    const { controller, scope } = compileDirective(
      '<div tr-my-tribes-toggle="tribeIds"></div>',
      {
        tribeIds: ['nomads'],
      },
    );

    $rootScope.$digest();

    controller.toggle = false;
    controller.onChange();
    scope.$digest();

    expect(scope.tribeIds).toEqual(['nomads']);
  });
});
