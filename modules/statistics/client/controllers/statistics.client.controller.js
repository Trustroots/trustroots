'use strict';

angular.module('statistics').controller('StatisticsController', ['$scope', '$interval', 'Statistics',
  function($scope, $interval, Statistics) {

    // Dec 23, 2014
    $scope.launchDate = new Date(2014, 11, 23);

    $scope.statistics = Statistics.get();

    // Update page every now and then while it's open
    var statsInterval = $interval(function(){
      Statistics.get({}, function(statistics){
        $scope.statistics = statistics;
      });
    }, (5 * 60000)); // every 5mins

    // Clean interval when leaving the page
    $scope.$on('$destroy', function() {
      if (statsInterval) {
        $interval.cancel(statsInterval);
      }
    });

  }
]);
