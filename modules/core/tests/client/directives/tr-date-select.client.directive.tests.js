import AppConfig from '@/modules/core/client/app/config';
import moment from 'moment';
import '@/modules/core/client/directives/tr-date-select.client.directive';

describe('trDateSelect directive', function () {
  let $compile;
  let $rootScope;

  beforeEach(function () {
    global.moment = moment;
    angular.mock.module(AppConfig.appModuleName);
  });

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  function compile(value = '', attrs = '') {
    const scope = $rootScope.$new();
    scope.date = value;

    const element = $compile(
      `<input type="text" tr-date-select ng-model="date" ${attrs} />`,
    )(scope);
    scope.$digest();

    return {
      element,
      scope,
      isolateScope: element.isolateScope(),
    };
  }

  it('hydrates parsed date values into year, month and date selectors', function () {
    const { isolateScope } = compile(
      '2026-03-10',
      'min="2026-01-01" max="2026-12-31"',
    );

    expect(isolateScope.val).toEqual({
      year: 2026,
      month: 3,
      date: 10,
    });
    expect(isolateScope.years).toEqual([2026]);
    expect(isolateScope.months[0]).toMatchObject({
      name: 'January',
      value: 1,
    });
    expect(isolateScope.months[11]).toMatchObject({
      name: 'December',
      value: 12,
    });
    expect(isolateScope.dates[0]).toBe(1);
    expect(isolateScope.dates[isolateScope.dates.length - 1]).toBe(31);
  });

  it('writes a complete date back as YYYY-MM-DD', function () {
    const { isolateScope, scope } = compile(
      '',
      'min="2026-01-01" max="2026-12-31"',
    );

    isolateScope.val = {
      year: 2026,
      month: 1,
      date: 8,
    };
    scope.$digest();

    expect(scope.date).toBe('2026-01-08');
  });

  it('uses the default minimum date when none is configured', function () {
    const { isolateScope } = compile('', 'max="2026-12-31"');

    expect(isolateScope.min.format('YYYY-MM-DD')).toBe('1900-01-01');
    expect(isolateScope.years[0]).toBe(2026);
    expect(isolateScope.years[isolateScope.years.length - 1]).toBe(1900);
  });

  it('resets date model to null when date is incomplete', function () {
    const { isolateScope, scope } = compile(
      '2026-01-08',
      'min="2026-01-01" max="2026-12-31"',
    );

    isolateScope.val.month = 2;
    isolateScope.val.date = undefined;
    scope.$digest();

    expect(scope.date).toBeNull();
  });

  it('normalizes out-of-range months when year changes', function () {
    const { isolateScope, scope } = compile(
      '2027-06-15',
      'min="2026-06-01" max="2026-12-31"',
    );

    isolateScope.val.year = 2026;
    isolateScope.val.month = 1;
    scope.$digest();

    expect(isolateScope.val.month).toBeUndefined();
  });

  it('limits days to the configured maximum date in the selected month', function () {
    const { isolateScope } = compile(
      '2026-06-12',
      'min="2026-06-01" max="2026-06-15"',
    );

    expect(isolateScope.dates[0]).toBe(1);
    expect(isolateScope.dates[isolateScope.dates.length - 1]).toBe(15);
  });

  it('clears selected days outside the valid range when month changes', function () {
    const { isolateScope, scope } = compile(
      '2026-06-20',
      'min="2026-06-10" max="2026-06-15"',
    );

    scope.$digest();

    expect(isolateScope.val.date).toBeUndefined();
    expect(scope.date).toBeNull();
  });
});
