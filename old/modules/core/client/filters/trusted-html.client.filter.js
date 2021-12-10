angular.module('core').filter('trustedHtml', trustedHtmlFilter);

/* @ngInject */
function trustedHtmlFilter($sce) {
  return function (input) {
    return $sce.trustAsHtml(input);
  };
}
