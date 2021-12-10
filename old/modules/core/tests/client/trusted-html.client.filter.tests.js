import AppConfig from '@/modules/core/client/app/config';

/**
 * Trusted HTML filter tests
 */
describe('Trusted HTML Filter Tests', function () {
  // Load the main application module
  beforeEach(angular.mock.module(AppConfig.appModuleName));

  it('should return string with html', inject(function (trustedHtmlFilter) {
    expect(
      trustedHtmlFilter('<b>HTML content</b>').$$unwrapTrustedValue(),
    ).toEqual('<b>HTML content</b>');
  }));
});
