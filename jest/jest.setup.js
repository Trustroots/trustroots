// eslint-disable-next-line no-undef
jest.mock('@/config/client/bootstrap');

global.L = require('leaflet');
global.jQuery = require('jquery');
require('angular');
require('angular-mocks');
require('@/modules/core/client/app/init');
require('@/modules/core/client/core.client.module');
