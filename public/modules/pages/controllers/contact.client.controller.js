'use strict';

angular.module('pages').controller('ContactController', ['$scope', '$window',
  function($scope, $window) {

    // Redirect to WP for now
    // https://github.com/Trustroots/trustroots/issues/106
    $window.location = 'http://ideas.trustroots.org/contact/';

  }
]);
