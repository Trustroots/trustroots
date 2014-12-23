'use strict';

angular.module('statistics').controller('StatisticsController', ['$scope', 'Statistics',
  function($scope, Statistics) {

    // Yay!
    $scope.launchDate = new Date(2014, 12, 22);

    $scope.statistics = Statistics.get();

  }
]);
