#!/usr/bin/env node

// Compare a Webpack stylesheet with a Vite stylesheet. Reports selector counts,
// RTL margin direction, and the non-inlined asset URL prefixes.

import { readFileSync } from 'node:fs';

const [webpackCssPath, viteCssPath, webpackRtlPath, viteRtlPath] =
  process.argv.slice(2);

if (!webpackCssPath || !viteCssPath || !webpackRtlPath || !viteRtlPath) {
  console.error(
    'Usage: node scripts/vite/compare-css.mjs <webpack.css> <vite.css> <webpack.rtl.css> <vite.rtl.css>',
  );
  process.exit(1);
}

interface CssSummary {
  bytes: number;
  rules: number;
  marginLeft: number;
  marginRight: number;
  urls: Record<string, number>;
}

function summarise(css: string): CssSummary {
  const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map(match =>
    match[1].replace(/^['"]|['"]$/g, ''),
  );
  const prefixes = new Map<string, number>();
  for (const url of urls) {
    const kind = url.startsWith('data:')
      ? 'data'
      : url.replace(/[^/]+$/, '').replace(/^\.\//, '/') || url;
    prefixes.set(kind, (prefixes.get(kind) || 0) + 1);
  }
  return {
    bytes: Buffer.byteLength(css),
    rules: css.split('}').length - 1,
    marginLeft: css.match(/margin-left/g)?.length ?? 0,
    marginRight: css.match(/margin-right/g)?.length ?? 0,
    urls: Object.fromEntries(prefixes),
  };
}

function report(label: string, filePath: string): CssSummary {
  const summary = summarise(readFileSync(filePath, 'utf8'));
  console.log(label, JSON.stringify(summary));
  return summary;
}

report('webpack', webpackCssPath);
report('vite', viteCssPath);
report('webpack-rtl', webpackRtlPath);
report('vite-rtl', viteRtlPath);
