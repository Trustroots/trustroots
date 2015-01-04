'use strict';

// Configuring the angular-ui-select package to use bootstrap theme
angular.module('core').config(function(uiSelectConfig) {
  uiSelectConfig.theme = 'bootstrap';
});

// Default timeout for 'message-center' success/alert messages
var flashTimeout = 6000;
