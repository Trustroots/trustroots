(function() {
  'use strict';

  angular
    .module('pages')
    .controller('ContactController', ContactController);

  /* @ngInject */
  function ContactController($window) {

    /**
     * Redirect to Wordpress for now
     * @todo https://github.com/Trustroots/trustroots/issues/106
     */
    $window.location = 'http://ideas.trustroots.org/contact/';

  }
})();
