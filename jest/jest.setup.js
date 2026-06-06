// jsdom doesn't expose these, but some deps (e.g. nostr-tools) need them.
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

if (global.HTMLCanvasElement) {
  global.HTMLCanvasElement.prototype.getContext = function getContext() {
    return {
      canvas: this,
      beginPath() {},
      clearRect() {},
      closePath() {},
      drawImage() {},
      fill() {},
      fillRect() {},
      fillText() {},
      getImageData() {
        return { data: [] };
      },
      lineTo() {},
      measureText() {
        return { width: 0 };
      },
      moveTo() {},
      putImageData() {},
      restore() {},
      save() {},
      setTransform() {},
      stroke() {},
    };
  };

  global.HTMLCanvasElement.prototype.toDataURL = function toDataURL(type) {
    return `data:${type || 'image/png'};base64,`;
  };
}

global.L = require('leaflet');
global.jQuery = require('jquery');
require('angular');
require('angular-mocks');
require('@/modules/core/client/app/init');
require('@/modules/core/client/core.client.module');
