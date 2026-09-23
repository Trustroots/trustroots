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
 * Usage via JS import:
 * import plainTextLength from '@/modules/core/client/utils/plain-text-length';
 * plainTextLength('mystring')
 *
 * @link https://docs.angularjs.org/api/ng/filter/filter
 * @link http://stackoverflow.com/a/17315483/1984644
 */
import plainTextLength from '../utils/plain-text-length';

angular.module('core').filter('plainTextLength', plainTextLengthFilter);

function plainTextLengthFilter() {
  return plainTextLength;
}

export default plainTextLength;
