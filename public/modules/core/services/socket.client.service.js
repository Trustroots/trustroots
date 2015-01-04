'use strict';

/* This declares to JSHint that 'io' and 'settings' are global variables: */
/*global io:false */
/*global settings:false */

// Socket factory that provides the socket service
/*
angular.module('core').factory('Socket', ['socketFactory', '$location',
  function(socketFactory, $location) {
    return socketFactory({
      prefix: '',
      ioSocket: io.connect( $location.protocol() + '://' + $location.host() + ':' + $location.port(), {secure: settings.https} )
    });
  }
]);
*/
