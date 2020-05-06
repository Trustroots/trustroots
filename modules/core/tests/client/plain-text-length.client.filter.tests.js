import AppConfig from '@/modules/core/client/app/config';

/**
 * PlainTextLength filter tests
 */
describe('PlainTextLength Filter Tests', function () {
  // Load the main application module
  beforeEach(angular.mock.module(AppConfig.appModuleName));

  it('should return length for a string', inject(function (
    plainTextLengthFilter,
  ) {
    expect(plainTextLengthFilter('test')).toBe(4);
    expect(plainTextLengthFilter('')).toBe(0);
  }));

  it('should return length for a string after stripping out html', inject(function (
    plainTextLengthFilter,
  ) {
    expect(
      plainTextLengthFilter('<h1>HTML</h1><p><b>test&nbsp; test  </b></p>'),
    ).toBe(14);
  }));

  it('should return 0 length for non string values', inject(function (
    plainTextLengthFilter,
  ) {
    expect(plainTextLengthFilter(false)).toBe(0);
    expect(plainTextLengthFilter({ test: 'test' })).toBe(0);
    expect(plainTextLengthFilter(null)).toBe(0);
    expect(plainTextLengthFilter(['A', 'B', 'C'])).toBe(0);
    expect(plainTextLengthFilter(1 + 2)).toBe(0);
  }));

  it('should return length for a string after stripping white space', inject(function (
    plainTextLengthFilter,
  ) {
    expect(plainTextLengthFilter('   test   ')).toBe(4);
  }));
});
