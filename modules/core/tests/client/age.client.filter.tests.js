/**
 * Age filter tests
 */
(function () {
  'use strict';

  describe('Age Filter Tests', function () {

    // Load the main application module
    beforeEach(module(AppConfig.appModuleName));

    var dateObj = new Date(1985, 11, 22),
        ageDifMs = Date.now() - dateObj.getTime(),
        ageDate = new Date(ageDifMs), // miliseconds from epoch
        ageYears = Math.abs(ageDate.getUTCFullYear() - 1970);

    it('should return age in years from a date string', inject(function(ageyearsFilter) {
      expect(ageyearsFilter('1985-11-22')).toBe(ageYears + ' years');
    }));

    it('should return age in years from a date object', inject(function(ageyearsFilter) {
      expect(ageyearsFilter(new Date(1985, 11, 22))).toBe(ageYears + ' years');
    }));

  });

}());
