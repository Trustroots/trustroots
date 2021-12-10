import AppConfig from '@/modules/core/client/app/config';

/**
 * Age filter tests
 */
describe('Age Filter Tests', function () {
  // Load the main application module
  beforeEach(angular.mock.module(AppConfig.appModuleName));

  // Note that 10 is November in Date
  const dateObj = new Date(1985, 10, 22);
  const ageDifMs = Date.now() - dateObj.getTime();
  const ageDate = new Date(ageDifMs); // miliseconds from epoch
  const ageYears = Math.abs(ageDate.getUTCFullYear() - 1970);

  it('should return age in years from a date string', inject(function (
    ageyearsFilter,
  ) {
    expect(ageyearsFilter('1985-11-22')).toBe(ageYears + ' years');
  }));

  it('should return age in years from a date object', inject(function (
    ageyearsFilter,
  ) {
    expect(ageyearsFilter(new Date(1985, 10, 22))).toBe(ageYears + ' years');
  }));
});
