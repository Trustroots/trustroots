(function () {
  'use strict';

  angular
    .module('core')
    .directive('trPlaceholder', trPlaceholderDirective);

  function trPlaceholderDirective() {
    return {
      restrict: 'A',
      replace: true,
      scope: false,
      template:
        '<div class="tr-placeholder">' +
          '<span>Lorem ipsum</span><br>' +
          '<span>Lorem ipsum Lorem ipsum Lorem</span><br>' +
          '<span>Lorem ipsum Lorem ipsum.</span>' +
        '</div>'
    };
  }

}());
