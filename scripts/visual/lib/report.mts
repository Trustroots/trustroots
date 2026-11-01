// Writes OUT/index.html: a summary table and, for every comparison that is
// not identical, the before, after and diff images (cropped where possible).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Comparison } from './results.mts';

const escape = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"]/g,
    character =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]!,
  );

const labels: Record<string, string> = {
  identical: '🟢 identical',
  'styles-only': '🔵 styles only',
  noise: '⚪ noise',
  different: '🔴 different',
  error: '🟠 error',
};

export function writeReport(
  out: string,
  comparisons: Comparison[],
  meta: Record<string, string>,
) {
  const counts: Record<string, number> = {};
  for (const comparison of comparisons) {
    counts[comparison.result] = (counts[comparison.result] ?? 0) + 1;
  }
  const notable = comparisons.filter(c => c.result !== 'identical');
  const image = (c: Comparison, kind: string) =>
    c.images?.[kind]
      ? `<figure><figcaption>${kind}</figcaption><img src="${escape(c.images[kind])}"></figure>`
      : '';
  const detail = (c: Comparison) => {
    const crops = c.images?.['diff-crop']
      ? ['before-crop', 'after-crop', 'diff-crop']
      : ['before', 'after', 'diff'];
    const styles = c.styles.length
      ? `<details><summary>${c.styleDifferences} computed-style differences</summary><table><tr><th>Element</th><th>Property</th><th>Before</th><th>After</th></tr>${c.styles
          .map(
            s =>
              `<tr><td><code>${escape(s.path)}</code></td><td>${escape(s.property)}</td><td>${escape(s.before)}</td><td>${escape(s.after)}</td></tr>`,
          )
          .join('')}</table></details>`
      : '';
    return `<section id="${escape(c.key)}"><h3>${escape(c.key)} — ${labels[c.result]}</h3>
<p>${c.pixels} px differ${c.box ? ` in ${c.box.width}×${c.box.height} at ${c.box.x},${c.box.y}` : ''}.${c.note ? ` ${escape(c.note)}` : ''}${c.error ? ` <code>${escape(c.error)}</code>` : ''}</p>
<div class="row">${crops.map(kind => image(c, kind)).join('')}</div>${styles}</section>`;
  };
  const html = `<!doctype html><meta charset="utf-8"><title>Visual check</title>
<style>body{font:14px system-ui;margin:24px;max-width:1400px}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:2px 6px;text-align:start;vertical-align:top}.row{display:flex;gap:12px;flex-wrap:wrap}figure{margin:0}img{max-width:440px;border:1px solid #ccc;background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/16px 16px}code{font-size:12px}</style>
<h1>Visual check</h1>
<table>${Object.entries(meta)
    .map(([k, v]) => `<tr><th>${escape(k)}</th><td>${escape(v)}</td></tr>`)
    .join('')}</table>
<h2>Summary</h2>
<table><tr><th>Result</th><th>Comparisons</th></tr>${Object.entries(counts)
    .map(([k, v]) => `<tr><td>${labels[k] ?? k}</td><td>${v}</td></tr>`)
    .join('')}<tr><th>Total</th><th>${comparisons.length}</th></tr></table>
<h2>Every comparison that is not identical</h2>
<table><tr><th>Key</th><th>Result</th><th>Pixels</th><th>Style differences</th></tr>${notable
    .map(
      c =>
        `<tr><td><a href="#${escape(c.key)}">${escape(c.key)}</a></td><td>${labels[c.result]}</td><td>${c.pixels}</td><td>${c.styleDifferences}</td></tr>`,
    )
    .join('')}</table>
${notable.map(detail).join('\n')}`;
  writeFileSync(join(out, 'index.html'), html);
}
