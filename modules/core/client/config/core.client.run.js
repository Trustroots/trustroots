(function () {
  'use strict';

  angular
    .module('core')
    .run(coreRun);

  /* @ngInject */
  function coreRun(Facebook, push) {

    // Attempt to initialize Facebook SDK on first page load
    // If this fails, we'll try this again on successfull login
    Facebook.init();

    push.init();

  }

}());
