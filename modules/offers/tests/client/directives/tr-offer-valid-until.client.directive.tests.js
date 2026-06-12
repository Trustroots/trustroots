import moment from 'moment';
import AppConfig from '@/modules/core/client/app/config';
import '@/modules/offers/client/offers.client.module';
import '@/modules/offers/client/directives/tr-offer-valid-until.client.directive';

describe('trOfferValidUntil directive', function () {
  let $compile;
  let $rootScope;
  let dateNowSpy;
  let appSettings;

  beforeEach(function () {
    const fixedTime = new Date('2026-01-01T00:00:00.000Z');
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedTime.getTime());
    appSettings = {
      limits: {
        maxOfferValidFromNow: {
          days: 30,
        },
      },
    };

    angular.mock.module(AppConfig.appModuleName, $provide => {
      $provide.value('SettingsFactory', {
        get() {
          return appSettings;
        },
      });
    });
  });

  afterEach(function () {
    dateNowSpy.mockRestore();
  });

  beforeEach(inject(function (_$compile_, _$rootScope_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
  }));

  function compile(validUntil = undefined) {
    const scope = $rootScope.$new();
    scope.validUntil = validUntil;

    const element = $compile('<div tr-offer-valid-until="validUntil"></div>')(
      scope,
    );
    scope.$digest();

    return {
      element,
      scope,
      directive: element.isolateScope().trOfferValidUntil,
    };
  }

  it('starts in calendar mode when validUntil is predefined', function () {
    const until = new Date('2026-01-31T00:00:00.000Z');
    const { directive, scope } = compile(until);

    expect(directive.isCalendarVisible).toBe(true);
    expect(directive.validUntil).toEqual(until);
    expect(scope.validUntil).toEqual(until);
  });

  it('defaults to offerValidityInDays and future date when value is missing', function () {
    const { directive } = compile();
    const expected = moment().endOf('day').add({ days: 30 }).toDate();

    expect(directive.offerValidityInDays).toBe(30);
    expect(directive.validUntil).toEqual(expected);
  });

  it('recomputes validUntil when days selection changes', function () {
    const { directive, scope } = compile();

    directive.offerValidityInDays = 14;
    scope.$apply();

    const expected = moment().endOf('day').add({ days: 14 }).toDate();

    expect(directive.validUntil).toEqual(expected);
    expect(directive.isCalendarVisible).toBe(false);
  });

  it('uses the configured maximum date when days selection is empty', function () {
    appSettings.limits.maxOfferValidFromNow = { days: 45 };
    const { directive, scope } = compile();

    directive.offerValidityInDays = '';
    scope.$apply();

    const expected = moment().endOf('day').add({ days: 45 }).toDate();

    expect(directive.validUntil).toEqual(expected);
  });

  it('uses a 30-day max calendar range when settings omit an offer limit', function () {
    delete appSettings.limits.maxOfferValidFromNow;

    const { directive } = compile();
    const expected = moment().add({ days: 30 }).toDate();

    expect(directive.calendarOptions.maxDate).toEqual(expected);
  });

  it('updates parent validUntil when directive validUntil changes', function () {
    const { directive, scope } = compile();
    const nextDate = new Date('2026-01-20T00:00:00.000Z');

    directive.validUntil = nextDate;
    scope.$apply();

    expect(scope.validUntil).toEqual(nextDate);
  });
});
