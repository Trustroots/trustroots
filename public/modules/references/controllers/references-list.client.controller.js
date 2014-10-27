'use strict';

// References controller
angular.module('references').controller('ReferencesListController', ['$scope', '$log', '$state', '$stateParams', '$location', '$timeout', '$modal', 'Authentication', 'ReferencesBy', 'References',
  function($scope, $log, $state, $stateParams, $location, $timeout, $modal, Authentication, ReferencesBy, References ) {
    $scope.authentication = Authentication;

    // Fetch that offer for us...
    if(!$scope.references) {

      // Wait for profile from parent Controller (probably ProfileController)
      $scope.$parent.profile.$promise.then(function() {

        // Find a list of References
        $log.log('list references: ' + $scope.$parent.profile.id);

        ReferencesBy.query({
          userId: $scope.$parent.profile.id
        }, function(references) {

          // Make sure $scope.$apply() updates results
          // @link http://jimhoskins.com/2012/12/17/angularjs-and-apply.html
          $timeout(function() {
            $scope.references = references;
            console.log(references);
          });

        });
      });
    }

}
]);
