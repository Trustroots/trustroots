const { TextDecoder, TextEncoder } =
  require('node:util') as typeof import('node:util');

globalThis.TextEncoder = globalThis.TextEncoder || TextEncoder;
globalThis.TextDecoder = globalThis.TextDecoder || TextDecoder;

// The app registers its route manifest at start-up; do the same for tests.
require('../layers/shell/shared/route-manifest.mts');

if (globalThis.HTMLCanvasElement) {
  const canvasElement = globalThis.HTMLCanvasElement;

  function getContext(this: HTMLCanvasElement): CanvasRenderingContext2D {
    // Jest only needs the small drawing surface used by these tests.
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
        return { data: [] } as unknown as ImageData;
      },
      lineTo() {},
      measureText() {
        return { width: 0 } as TextMetrics;
      },
      moveTo() {},
      putImageData() {},
      restore() {},
      save() {},
      setTransform() {},
      stroke() {},
    } as unknown as CanvasRenderingContext2D;
  }

  Reflect.set(canvasElement.prototype, 'getContext', getContext);

  function toDataURL(this: HTMLCanvasElement, type?: string): string {
    return `data:${type || 'image/png'};base64,`;
  }
  Reflect.set(canvasElement.prototype, 'toDataURL', toDataURL);
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  // jsdom has no matchMedia; evaluate width/height queries against the
  // innerWidth/innerHeight tests set, and treat other features as unmatched.
  function evaluate(query: string): boolean {
    return query.split(/\s+and\s+/).every(feature => {
      const match = /^\((min|max)-(width|height):\s*(\d+)px\)$/.exec(
        feature.trim(),
      );
      if (!match) return false;
      const [, bound, dimension, limit] = match;
      const size =
        dimension === 'width' ? window.innerWidth : window.innerHeight;
      return bound === 'min' ? size >= Number(limit) : size <= Number(limit);
    });
  }

  Reflect.set(window, 'matchMedia', (media: string) => ({
    get matches() {
      return evaluate(media);
    },
    media,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }));
}

if (typeof window !== 'undefined') {
  const leafletModuleName: string = 'leaflet';
  const leaflet: unknown = require(leafletModuleName);
  Reflect.set(globalThis, 'L', leaflet);
}
