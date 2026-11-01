// Result records and their on-disk layout: OUT/images/<key>/<kind>.png plus
// OUT/results.json, rewritten after every comparison so a long run can be
// inspected while it is still going.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { StyleDifference } from './styles.mts';

export type Side = 'before' | 'after';

export type ResultKind =
  /** Same pixels and same computed styles. */
  | 'identical'
  /** Same pixels; computed styles differ somewhere. */
  | 'styles-only'
  /** Differs, but a repeat render matched the other side. */
  | 'noise'
  /** Differs on every repeat. */
  | 'different'
  | 'error';

export interface Comparison {
  suite: 'components' | 'app';
  key: string;
  name: string;
  viewport: string;
  dir: string;
  user?: string;
  pixels: number;
  styleDifferences: number;
  styles: StyleDifference[];
  result: ResultKind;
  box: { x: number; y: number; width: number; height: number } | null;
  size?: { width: [number, number]; height: [number, number] };
  note?: string;
  error?: string;
  images?: Record<string, string>;
}

export class ResultStore {
  readonly comparisons: Comparison[] = [];

  private readonly out: string;

  constructor(out: string) {
    this.out = out;
    mkdirSync(out, { recursive: true });
  }

  save = (comparison: Comparison, images: Record<string, Buffer>) => {
    comparison.images = {};
    for (const [kind, png] of Object.entries(images)) {
      const file = join('images', comparison.key, `${kind}.png`);
      mkdirSync(dirname(join(this.out, file)), { recursive: true });
      writeFileSync(join(this.out, file), png);
      comparison.images[kind] = file;
    }
    this.comparisons.push(comparison);
    this.flush();
    const mark = comparison.result === 'identical' ? '·' : '!';
    console.log(
      `${mark} ${comparison.key}: ${comparison.result}, ${comparison.pixels} px, ${comparison.styleDifferences} style differences${comparison.error ? ` (${comparison.error.split('\n')[0]})` : ''}`,
    );
  };

  flush() {
    writeFileSync(
      join(this.out, 'results.json'),
      `${JSON.stringify(this.comparisons, null, 2)}\n`,
    );
  }

  summary() {
    const counts: Record<string, number> = {};
    for (const comparison of this.comparisons) {
      counts[comparison.result] = (counts[comparison.result] ?? 0) + 1;
    }
    return counts;
  }
}
