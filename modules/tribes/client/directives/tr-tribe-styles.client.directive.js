(function () {
  /**
   * Directive to apply tribe color + image styles to an element
   *
   * Set background image dimensions (width x height): <div tr-tribe-dimensions="600x400"></div>
   * See https://uploadcare.com/documentation/cdn/#operation-scale-crop
   *
   * Set background image quality: <div tr-tribe-quality="normal"></div>
   * Options: normal, better, best, lighter (default), lightest
   * See https://uploadcare.com/documentation/cdn/#operation-quality
   *
   * Set progressive image loading: <div tr-tribe-progressive="yes"></div>
   * Options: yes (default), no
   * See https://uploadcare.com/documentation/cdn/#operation-progressive
   */
  angular
    .module('tribes')
    .directive('trTribeStyles', trTribeStylesDirective);

  /* @ngInject */
  function trTribeStylesDirective() {
    return {
      restrict: 'A',
      replace: false,
      scope: false,
      link: function (scope, elem, attrs) {

        if (angular.isDefined(attrs.trTribeStyles) && attrs.trTribeStyles !== '') {
          var style = '',
              tribe = angular.fromJson(attrs.trTribeStyles);

          // Set background image
          // Uses Uploadcare.com to resize and deliver images
          if (tribe.image_UUID) {
            var dimensions = (angular.isDefined(attrs.trTribeStylesDimensions) && attrs.trTribeStylesDimensions !== '') ? attrs.trTribeStylesDimensions : '1024x768',
                quality = (angular.isDefined(attrs.trTribeStylesQuality) && attrs.trTribeStylesQuality !== '') ? attrs.trTribeStylesQuality : 'lighter',
                progressive = (angular.isDefined(attrs.trTribeStylesProgressive) && (attrs.trTribeStylesProgressive === 'yes' || attrs.trTribeStylesProgressive === 'no')) ? attrs.trTribeStylesProgressive : 'no';

            // Available CDN parameters: https://uploadcare.com/documentation/cdn/
            var img_params = [
              'progressive/' + progressive,
              'scale_crop/' + dimensions + '/center',
              'quality/' + quality,
              'format/jpeg'
            ];

            style += 'background-image: url(https://ucarecdn.com/' + tribe.image_UUID + '/-/' + img_params.join('/-/') + '/);';
          }

          if (tribe.color) {
            style += 'background-color: #' + tribe.color + ';';
          }

          if (style !== '') {
            attrs.$set('style', style);
          }
        }

      }
    };
  }
}());
