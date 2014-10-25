'use strict';

/* This declares to JSHint that 'io' is a global variable: */
/*global io:false */

// Socket factory that provides the socket service
angular.module('core').factory('Socket', ['socketFactory', '$location',
    function(socketFactory, $location) {
        return socketFactory({
            prefix: '',
            ioSocket: io.connect( $location.protocol() + '://' + $location.host() + ':' + $location.port() )
        });
    }
]);
