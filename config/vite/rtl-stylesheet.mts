import { createRequire } from 'node:module';
import type { Plugin, Rollup } from 'vite';

const require = createRequire(import.meta.url);
const rtlcss = require('rtlcss');

const stylesheetName = 'react-main.css';
const rtlStylesheetName = 'react-main.rtl.css';

export interface RtlStylesheetAsset {
  type: 'asset';
  fileName: string;
  source: string | Uint8Array;
}

export interface RtlStylesheetBundle {
  [fileName: string]: RtlStylesheetAsset | { type: 'chunk'; fileName: string };
}

export interface RtlStylesheetPluginContext {
  error(message: string): never;
  emitFile(asset: RtlStylesheetAsset): string;
}

export interface RtlStylesheetPlugin {
  generateBundle(
    this: RtlStylesheetPluginContext,
    options: Record<string, unknown>,
    bundle: RtlStylesheetBundle,
  ): void;
}

function stylesheetSource(asset: { source: string | Uint8Array }): string {
  if (typeof asset.source === 'string') return asset.source;
  return Buffer.from(asset.source).toString('utf8');
}

/**
 * Emit the RTL stylesheet alongside the standard client stylesheet.
 * Production Express and the client language switch both request this file.
 */
export function rtlStylesheetPlugin(): Plugin {
  return {
    name: 'trustroots-rtl-stylesheet',
    apply: 'build',
    // Vite adds the extracted stylesheet after normal plugins run.
    enforce: 'post',
    generateBundle(_options, bundle) {
      const stylesheets = Object.values(bundle).filter(
        (asset): asset is Rollup.OutputAsset =>
          asset.type === 'asset' &&
          typeof asset.fileName === 'string' &&
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
