'use strict';


angular.module('pages').controller('HomeController', ['$scope', '$rootScope', '$state', '$timeout', 'Authentication',
  function($scope, $rootScope, $state, $timeout, Authentication) {

    // Redirect logged-in users out from front page
    if( Authentication.user ) {
      $state.go('search');
    }
    else if(!$rootScope.demoNotificationDone) {
      $rootScope.demoNotificationDone = true;
      $timeout(function(){
        alert('Hey! This is a demo and still work in progress. \n\nYou can click around but things are likely to break, change or data might disappear before we publish this widely. \n\nThanks & enjoy!');
      }, 1000);
    }

  }
]);
