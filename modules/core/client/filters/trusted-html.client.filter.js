'use strict';

angular.module('core').filter('trustedHtml', ['$sce',
  function($sce) {
    return function(input) {
      return $sce.trustAsHtml(input);
    };
  }
]);
