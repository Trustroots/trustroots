'use strict';

angular.module('messages').controller('MessagesInboxController', ['$scope', '$state', '$log', 'Authentication', 'Messages', '$q',//, 'Socket'
  function($scope, $state, $log, Authentication, Messages, $q) {//, Socket

    $scope.user = Authentication.user;

    //Pagination vars
    var previousPage;
    $scope.nextPage ='';
    $scope.threads =[];
    //variable for flow control
    var paginationTimer;

    /*
    Socket.on('message.thread', function(thread) {
        $log.log('->refresh inbox');
        $scope.findInbox();
    });
    */

    //Parses link header for pagination parameters.
    function parseHeaders(header){
      if(header){
        return {
          page: /<.*\/[^<>]*\?.*page=(\d*).*>;.*/.exec(header)[1],
          limit: /<.*\/[^<>]*\?.*limit=(\d*).*>;.*/.exec(header)[1]
        };
      }
      else {return header;}
    }

    /**
     * Fetches threads and sets up pagination environment
     * Takes additional query params passed in as key , value pairs
     */
    $scope.fetchThreads = function(param){
      var deferred = $q.defer();
      if (param) { var query = param; }

      Messages.query(
        query,
        //Successful call
        function(results,headers){
          angular.forEach(results, function(data){$scope.threads.push(data);});
          $scope.nextPage = parseHeaders(headers().link);
          $scope.fetchThreads.resolved = true;

          paginationTimer = false;
          deferred.resolve();
        },
        //Rejected call
        function(){
          $scope.fetchThreads.resolved = 'reject';
          paginationTimer = false;
          deferred.reject();
        }
      );
      return deferred.promise;
    };

    /*
    * Fetches next page of threads
    * Activates when the last thread element hits the bottom view port
    */
    $scope.moreMessages = function(waypoint){
      if($scope.nextPage && $scope.nextPage !== previousPage && waypoint && !paginationTimer){
        paginationTimer = $scope.fetchThreads($scope.nextPage)
      }
    };

    /**
     * Solve which of two thread participants is "the other", not logged in user
     * This is needed since thread handle has two fields for users 'userTo' and 'userFrom'
     * and either one can be 'the other', depending who replied the latest.
     *
     * Return either displayName or user object
     */
    $scope.otherParticipant = function(thread, value) {

      // $scope.user holds currently authenticated user
      var other = (thread.userFrom._id === $scope.user._id) ? thread.userTo : thread.userFrom;

      if (value === 'displayName') {
        return other.displayName;
      }
      else if (value === 'id') {
        return other._id;
      }
      else {
        // User object
        return other;
      }

    };

    /**
     * Open thread
     */
    $scope.openThread = function(thread) {
      $state.go('listMessages', { userId: $scope.otherParticipant(thread, 'id') });
    };

  }
]);
