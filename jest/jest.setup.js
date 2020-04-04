global.L = require('leaflet');
global.jQuery = require('jquery');

const angular = require('angular');
require('angular-mocks');

require('@/modules/core/client/app/init');
require('@/modules/core/client/core.client.module');

// loading angular-waypoints doesn't play nicely
// in jest, so we stub it's loading in jest.config.js
// and provide an empty module definition for use in tests
angular.module('zumba.angular-waypoints', []);
