const { TextDecoder, TextEncoder } =
  require('node:util') as typeof import('node:util');

globalThis.TextEncoder = globalThis.TextEncoder || TextEncoder;
globalThis.TextDecoder = globalThis.TextDecoder || TextDecoder;

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

if (typeof window !== 'undefined') {
  const leafletModuleName: string = 'leaflet';
  const leaflet: unknown = require(leafletModuleName);
  Reflect.set(globalThis, 'L', leaflet);
}
