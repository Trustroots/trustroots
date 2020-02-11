angular.module('core').run(coreRun);

/* @ngInject */
function coreRun(Facebook, push) {
  // Attempt to initialize Facebook SDK on first page load
  // If this fails, we'll try this again on successfull login
  Facebook.init();

  // Initialize the push service if available
  // It will check if user intended to enable push for this browser
  // and setup the service-worker and backend registration accordingly
  push.init();
}
