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
 * import plainTextLength from '@/modules/core/client/filters/plain-text-length.client.filter';
 * plainTextLength('mystring')
 *
 * @link https://docs.angularjs.org/api/ng/filter/filter
 * @link http://stackoverflow.com/a/17315483/1984644
 */
angular.module('core').filter('plainTextLength', plainTextLengthFilter);

function plainTextLengthFilter() {
  return plainTextLength;
}

// Allow it to be used via direct import too
export default function plainTextLength(string) {
  return string && angular.isString(string)
    ? String(string)
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]+>/gm, '')
        .trim().length
    : 0;
}
