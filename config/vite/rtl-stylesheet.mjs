import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const rtlcss = require('rtlcss');

const stylesheetName = 'react-main.css';
const rtlStylesheetName = 'react-main.rtl.css';

function stylesheetSource(asset) {
  if (typeof asset.source === 'string') return asset.source;
  return Buffer.from(asset.source).toString('utf8');
}

/**
 * Emit the same RTL stylesheet filename as Webpack's RTL plugin.
 * Production Express and the client language switch both request this file.
 */
export function rtlStylesheetPlugin() {
  return {
    name: 'trustroots-rtl-stylesheet',
    apply: 'build',
    // Vite adds the extracted stylesheet after normal plugins run.
    enforce: 'post',
    generateBundle(_options, bundle) {
      const stylesheets = Object.values(bundle).filter(
        asset =>
          asset.type === 'asset' &&
          asset.fileName &&
          asset.fileName.endsWith(stylesheetName),
      );

      if (stylesheets.length !== 1) {
        this.error(
          `Expected one ${stylesheetName} asset to generate ${rtlStylesheetName}, found ${stylesheets.length}.`,
        );
      }

      this.emitFile({
        type: 'asset',
        fileName: rtlStylesheetName,
        source: rtlcss.process(stylesheetSource(stylesheets[0])),
      });
    },
  };
}
