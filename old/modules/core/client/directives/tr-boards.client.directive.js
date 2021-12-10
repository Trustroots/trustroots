import photos from '@/modules/core/client/services/photos.service';

/**
 * Directive that simply picks a background image given element and emits copyright info down the scope.
 *
 * Usage:
 * <div tr-boards="imageid">
 *
 * Or from many:
 * <div tr-boards="['imageid1', 'imageid2']">
 *
 * To stop cover image being set for small screens (<= 480px width),
 * use `tr-boards-ignore-small` attribute.
 *
 */
angular.module('core').directive('trBoards', trBoardsDirective);

/* @ngInject */
function trBoardsDirective($window) {
  return {
    restrict: 'A',
    replace: false,
    scope: {
      trBoards: '=',
    },
    link(scope, elem, attrs) {
      // Don't set background images for mobile screens if defined so via attribute
      if (
        angular.isDefined(attrs.trBoardsIgnoreSmall) &&
        $window.innerWidth <= 480
      ) {
        return;
      }

      // If requested photo is missing or request is invalid, rely on this photo
      const defaultPhoto = 'bokeh';

      // scope.trBoards might be an array (therefore just pick one key from it) or a string (thus just use it as is)
      const key = angular.isArray(scope.trBoards)
        ? scope.trBoards[Math.floor(Math.random() * scope.trBoards.length)]
        : scope.trBoards;

      // Pick the photo
      const photo = photos[key] || photos[defaultPhoto];

      // Add photo as a background to the element
      elem.addClass('board-' + key);

      // For small screens, if mobile image exists, use it
      const file =
        $window.innerWidth <= 480 && photo.file_mobile
          ? photo.file_mobile
          : photo.file;

      elem.css({
        'background-image': 'url(/img/board/' + file + ')',
      });

      // To prevent key being literally `key`: `{key: ...}`, we want it to be actual keyname such as `hitchroad`.
      const photoObject = {};
      photoObject[key] = photo;

      // Send copyright info down the scope... something will pick it up! (pst, core/app-controller)
      scope.$emit('photoCreditsUpdated', photoObject);
    },
  };
}
