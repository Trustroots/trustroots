'use strict';

//Messages service used for communicating with the messages REST endpoints
angular.module('messages').factory('Messages', ['$resource',
  function($resource) {

    function MessageHandler(){
      // Control flow variable; Prevents multiple identical ajax calls
      this.paginationTimeout = false;
      // Used in views for show/hide information
      this.resolved = '';
      this.nextPage = '';
    }

    MessageHandler.prototype ={
      parseHeaders: function (header){
        if(header){
          return {
            page: /<.*\/[^<>]*\?.*page=(\d*).*>;.*/.exec(header)[1],
            limit: /<.*\/[^<>]*\?.*limit=(\d*).*>;.*/.exec(header)[1]
          };
        }
        else {return header;}
      },
      /**
      * Fetches messages and sets up pagination environment
      * Takes additional query params passed in as key , value pairs
      */
      fetchMessages: function(param){
        var that = this;
        var query = (this.nextPage) ? angular.extend(this.nextPage, param): param;

        if(!this.paginationTimeout){
          this.paginationTimeout = true;

          return(this.ajaxCall.query(
            query,
            //Successful callback
            function(data, headers){
              that.nextPage = that.parseHeaders(headers().link);
              that.resolved = true;
              that.paginationTimeout = false;
            },
            //Error callback
            function(){
              that.paginationTimeout = false;
              that.resolved = false;
            }
          ));
        }
      },
      ajaxCall: $resource('messages/:userId',
        { userId: '@_id' },
        { update: { method: 'PUT' } }
      )
    };
    return MessageHandler;
  }
]);

angular.module('messages').factory('MessagesRead', ['$resource',
  function($resource) {
    return $resource('messages-read', {
      messageIds: '@messageIds'
    }, {
      query: {
        method: 'POST',
        isArray: false,
        cache: false
      }
    });
  }
]);
