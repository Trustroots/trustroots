// jsdom doesn't expose these, but some deps (e.g. nostr-tools) need them.
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

global.L = require('leaflet');
global.jQuery = require('jquery');
require('angular');
require('angular-mocks');
require('@/modules/core/client/app/init');
require('@/modules/core/client/core.client.module');
