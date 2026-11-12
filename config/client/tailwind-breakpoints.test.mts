import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';

import { compile } from 'tailwindcss';

const stylesDir = path.join(import.meta.dirname, 'styles');
const resolveFrom = createRequire(path.join(stylesDir, 'tailwind.css'));

async function build(candidates: string[]): Promise<string> {
  const compiler = await compile(
    readFileSync(path.join(stylesDir, 'tailwind.css'), 'utf8'),
    {
      base: stylesDir,
      async loadStylesheet(id, base) {
        const file = id.startsWith('.')
          ? path.resolve(base, id)
          : resolveFrom.resolve(id);
        return {
          path: file,
          base: path.dirname(file),
          content: readFileSync(file, 'utf8'),
        };
      },
    },
  );
  return compiler.build(candidates);
}

test('bs-* breakpoints match the Bootstrap 3 grid', async () => {
  const css = await build([
    'tw:max-bs-sm:hidden',
    'tw:bs-sm:block',
    'tw:max-bs-md:hidden',
    'tw:bs-md:block',
    'tw:max-bs-lg:hidden',
    'tw:bs-lg:block',
  ]);

  for (const query of [
    '(width < 768px)',
    '(width >= 768px)',
    '(width < 992px)',
    '(width >= 992px)',
    '(width < 1200px)',
    '(width >= 1200px)',
  ]) {
    assert.ok(css.includes(`@media ${query}`), `missing @media ${query}`);
  }
});

test('the default sm and md breakpoints are untouched', async () => {
  const css = await build(['tw:sm:block', 'tw:md:block']);

  assert.ok(css.includes('@media (width >= 40rem)'));
  assert.ok(css.includes('@media (width >= 48rem)'));
});
