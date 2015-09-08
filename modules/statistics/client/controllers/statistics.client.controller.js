(function() {
  'use strict';

  angular
    .module('statistics')
    .controller('StatisticsController', StatisticsController);

  /* @ngInject */
  function StatisticsController($scope, $interval, Statistics, data) {

    // ViewModel
    var vm = this;

    vm.launchDate = new Date(2014, 11, 23); // Dec 23, 2014
    vm.data = data;

    // Update page every now and then while it's open
    var statsInterval = $interval(function() {
      Statistics.get({}, function(data) {
        vm.data = data;
      });
    }, (5 * 60000)); // every 5mins

    // Clean interval when leaving the page
    $scope.$on('$destroy', function() {
      if (statsInterval) {
        $interval.cancel(statsInterval);
      }
    });

  }
})();
