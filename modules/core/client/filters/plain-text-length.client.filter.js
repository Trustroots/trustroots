(function () {
  /**
   * Return length of a string without html
   * Very crude html stripping, which is enough for estimating if text is short/empty without html tags
   *
   * Usage in templates:
   * {{ 'myString' | plainTextLength }}
   *
   * Usage via JS:
   * $filter('plainTextLength')('myString')
   *
   * @link https://docs.angularjs.org/api/ng/filter/filter
   * @link http://stackoverflow.com/a/17315483/1984644
   */
  angular
    .module('core')
    .filter('plainTextLength', plainTextLengthFilter);

  function plainTextLengthFilter() {
    return function (string) {
      return string && angular.isString(string) ? String(string).replace(/&nbsp;/g, ' ').replace(/<[^>]+>/gm, '').trim().length : 0;
    };
  }
}());
