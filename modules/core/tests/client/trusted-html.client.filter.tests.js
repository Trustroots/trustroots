/**
 * Trusted HTML filter tests
 */
(function () {
  describe('Trusted HTML Filter Tests', function () {

    // Load the main application module
    beforeEach(module(AppConfig.appModuleName));

    it('should return string with html', inject(function (trustedHtmlFilter) {
      expect(trustedHtmlFilter('<b>HTML content</b>').$$unwrapTrustedValue()).toEqual('<b>HTML content</b>');
    }));

  });
}());
