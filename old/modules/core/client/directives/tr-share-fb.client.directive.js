/* global FB */
/**
 * FB share button for current URL
 *
 * Usage:
 * ```
 * <div tr-share-facebook></div>
 * ```
 */
angular.module('core').directive('trShareFb', trShareFbDirective);

/* @ngInject */
function trShareFbDirective($rootScope, $window, Authentication) {
  return {
    restrict: 'A',
    replace: true,
    scope: false,
    link: trShareFbDirectiveLink,
  };

  function trShareFbDirectiveLink(scope, element) {
    // Don't show share button if user isn't connected to FB
    if (
      !Authentication.user ||
      !Authentication.user.additionalProvidersData ||
      !Authentication.user.additionalProvidersData.facebook
    ) {
      return;
    }

    // FB API ready, activate
    if (angular.isDefined($window.FB)) {
      activate();
    } else {
      // FB API was not ready, wait for the ready event
      const watch = $rootScope.$on('facebookReady', function () {
        activate();
        // Removes watch:
        watch();
      });
    }

    /**
     * Activate directive
     * https://developers.facebook.com/docs/plugins/share-button
     */
    function activate() {
      const button =
        '<div ' +
        'class="fb-share-button" ' +
        'data-href="' +
        location.href +
        '" ' +
        'data-layout="button_count" ' +
        'data-size="small" ' +
        'data-mobile-iframe="true"> ' +
        '  <a class="fb-xfbml-parse-ignore" ' +
        '    target="_blank" ' +
        '    href="https://www.facebook.com/sharer/sharer.php?u=' +
        encodeURIComponent(location.href) +
        '">' +
        '      Share' +
        '  </a> ' +
        '</div>';

      element.html(button);

      // Parse XFBML code
      FB.XFBML.parse(element[0]);
    }
  }
}
