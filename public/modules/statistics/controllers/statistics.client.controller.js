'use strict';

angular.module('statistics').controller('StatisticsController', ['$scope', 'Statistics',
  function($scope, Statistics) {

    // Dec 23, 2014
    $scope.launchDate = new Date(2014, 11, 23);

    $scope.statistics = Statistics.get();

  }
]);
