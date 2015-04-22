'use strict';

// Socket factory that provides the socket service
/*
angular.module('core').factory('Socket', ['socketFactory', '$location', 'SettingsFactory',
  function(socketFactory, $location, SettingsFactory) {

    var settings = SettingsFactory.get();

    return socketFactory({
      prefix: '',
      ioSocket: io.connect( $location.protocol() + '://' + $location.host() + ':' + $location.port(), {secure: settings.https} )
    });
  }
]);
*/
