'use strict';

/* This declares to JSHint that 'io' is a global variable: */
/*global io:false */

// Socket factory that provides the socket service
angular.module('core').factory('Socket', ['socketFactory',
    function(socketFactory) {
        return socketFactory({
            prefix: '',
            ioSocket: io.connect('http://localhost:3000') //@todo: path+port
        });
    }
]);