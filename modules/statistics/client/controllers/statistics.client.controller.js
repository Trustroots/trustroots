(function () {
  angular
    .module('statistics')
    .controller('StatisticsController', StatisticsController);

  /* @ngInject */
  function StatisticsController($scope, $interval, Statistics, statisticsData) {

    // ViewModel
    var vm = this;

    vm.statisticsData = statisticsData;
    vm.launchDate = new Date(2014, 11, 23); // Dec 23, 2014

    // Process statistics data at init
    statisticsData.$promise.then(function () {
      processStats(statisticsData);
    });

    // Update page every now and then while it's open
    var statsInterval = $interval(function () {
      Statistics.get({}, function (statisticsData) {
        processStats(statisticsData);
      });
    }, (10 * 60000)); // every 10 mins

    // Clean interval when leaving the page
    $scope.$on('$destroy', function () {
      if (statsInterval) {
        $interval.cancel(statsInterval);
      }
    });

    function processStats(data) {

      angular.extend(vm, data);

      vm.hostingTotal = data.hosting.yes + data.hosting.maybe;
      vm.hostingPercentage = (vm.hostingTotal / data.total) * 100;
      vm.hostingYesPercentage = (data.hosting.yes / vm.hostingTotal) * 100;
      vm.hostingMaybePercentage = (data.hosting.maybe / vm.hostingTotal) * 100;

      vm.newsletterPercentage = (data.newsletter / data.total) * 100;

      vm.connections = [];
      angular.forEach(data.connected, function (count, network) {
        vm.connections.push({
          network: network,
          count: count
        });
      });

    }

  }
}());
