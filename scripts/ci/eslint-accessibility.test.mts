import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESLint } from 'eslint';

const eslint = new ESLint();

test('client JSX rejects inaccessible markup through the repository lint configuration', async () => {
  const [result] = await eslint.lintText(
    `export default function Example() {
      return <div onClick={() => {}}>
        <img src="/example.png" />
        <input aria-invalid="invalid-value" tabIndex={3} autoFocus />
      </div>;
    }`,
    { filePath: 'modules/core/client/components/AccessibilityExample.tsx' },
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
      result.messages.some(
        message =>
          message.ruleId === `jsx-a11y/${rule}` && message.severity === 2,
      ),
      `Expected a blocking jsx-a11y/${rule} diagnostic`,
    );
  }
});

test('client JSX accepts labelled native controls', async () => {
  const [result] = await eslint.lintText(
    `export default function Example() {
      return <button type="button" aria-label="Open profile" onClick={() => {}}>
        <img src="/example.png" alt="" aria-hidden="true" />
      </button>;
    }`,
    { filePath: 'modules/core/client/components/AccessibilityExample.tsx' },
  );
  assert.deepEqual(
    result.messages.filter(message => message.ruleId?.startsWith('jsx-a11y/')),
    [],
  );
});
