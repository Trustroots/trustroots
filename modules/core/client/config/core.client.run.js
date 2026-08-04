angular.module('core').run(coreRun);

/* @ngInject */
function coreRun(push) {
  // Initialize the push service if available
  // It will check if user intended to enable push for this browser
  // and setup the service-worker and backend registration accordingly
  push.init();
}
