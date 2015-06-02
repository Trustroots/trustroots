'use strict';

angular.module('pages').controller('AboutController', ['$scope', 'Authentication',
  function($scope, Authentication) {

    $scope.user = Authentication.user;

  }
]);
