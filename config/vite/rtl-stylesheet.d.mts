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

export function rtlStylesheetPlugin(): RtlStylesheetPlugin;
