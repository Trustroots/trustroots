/**
 * Facebook share button for the current URL.
 *
 * This remains available to members with a legacy Facebook connection, but it
 * uses Facebook's normal sharing URL and does not load the Facebook SDK.
 */
angular.module('core').directive('trShareFb', trShareFbDirective);

/* @ngInject */
function trShareFbDirective($window, Authentication) {
  return {
    restrict: 'A',
    replace: true,
    scope: false,
    link: trShareFbDirectiveLink,
  };

  function trShareFbDirectiveLink(scope, element) {
    if (
      !Authentication.user ||
      !Authentication.user.additionalProvidersData ||
      !Authentication.user.additionalProvidersData.facebook
    ) {
      return;
    }

    const shareUrl =
      'https://www.facebook.com/sharer/sharer.php?u=' +
      encodeURIComponent($window.location.href);

    element.html(
      '<a class="btn btn-default btn-xs" target="_blank" rel="noopener" ' +
        'href="' +
        shareUrl +
        '">Share</a>',
    );
  }
}
