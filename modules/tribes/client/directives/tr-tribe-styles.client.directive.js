import { canUseWebP } from '@/modules/core/client/utils/dom';
import { getCircleBackgroundUrl } from '@/modules/tribes/client/utils';

/**
 * Directive to apply tribe color + image styles to an element
 *
 * Set background image dimensions (width x height): <div tr-tribe-dimensions="600x400"></div>
 */
angular.module('tribes').directive('trTribeStyles', trTribeStylesDirective);

/* @ngInject */
function trTribeStylesDirective() {
  return {
    restrict: 'A',
    replace: false,
    scope: false,
    link(scope, elem, attrs) {
      if (
        !angular.isDefined(attrs.trTribeStyles) ||
        attrs.trTribeStyles === '' ||
        !angular.isDefined(attrs.trTribeStylesDimensions) ||
        attrs.trTribeStylesDimensions === ''
      ) {
        return;
      }

      let style = '';
      const tribe = angular.fromJson(attrs.trTribeStyles);

      // Set background image
      if (tribe.image) {
        const dimensions =
          angular.isDefined(attrs.trTribeStylesDimensions) &&
          attrs.trTribeStylesDimensions !== ''
            ? attrs.trTribeStylesDimensions
            : '1024x768';

        const imageFormat = canUseWebP() ? 'webp' : 'jpg';
        const imageUrl = getCircleBackgroundUrl(
          tribe.slug,
          dimensions,
          imageFormat,
        );

        style += `background-image:url(${imageUrl});`;
      }

      // Set background color
      if (tribe.color) {
        style += `background-color:#${tribe.color};`;
      }

      if (style !== '') {
        attrs.$set('style', style);
      }
    },
  };
}
