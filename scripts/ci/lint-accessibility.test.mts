import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';

const probe = `modules/core/client/components/AccessibilityExample.${process.pid}.tsx`;

function lintClientJsx(source: string): { code: string; severity: string }[] {
  writeFileSync(probe, source);
  let output: string;
  try {
    output = execFileSync(
      'pnpm',
      ['exec', 'oxlint', '--format', 'json', probe],
      { encoding: 'utf8' },
    );
  } catch (error) {
    // oxlint exits non-zero when it reports errors.
    const { stdout } = error as { stdout?: string };
    if (!stdout) throw error;
    output = stdout;
  } finally {
    rmSync(probe);
  }
  return JSON.parse(output).diagnostics;
}

test('client JSX rejects inaccessible markup through the repository lint configuration', () => {
  const diagnostics = lintClientJsx(
    `export default function Example() {
      return <div onClick={() => {}}>
        <img src="/example.png" />
        <input aria-invalid="invalid-value" tabIndex={3} autoFocus />
      </div>;
    }`,
  );
  for (const rule of [
    'alt-text',
    'aria-proptypes',
    'click-events-have-key-events',
    'no-static-element-interactions',
    'tabindex-no-positive',
    'no-autofocus',
  ]) {
    assert.ok(
      diagnostics.some(
        ({ code, severity }) =>
          code === `jsx-a11y(${rule})` && severity === 'error',
      ),
      `Expected a blocking jsx-a11y/${rule} diagnostic`,
    );
  }
});

test('client JSX accepts labelled native controls', () => {
  const diagnostics = lintClientJsx(
    `export default function Example() {
      return <button type="button" aria-label="Open profile" onClick={() => {}}>
        <img src="/example.png" alt="" aria-hidden="true" />
      </button>;
    }`,
  );
  assert.deepEqual(
    diagnostics.filter(({ code }) => code.startsWith('jsx-a11y(')),
    [],
  );
});
