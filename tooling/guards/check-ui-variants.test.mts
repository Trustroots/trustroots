import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { analyze } from './check-ui-variants.mts';

const reactTypes = path.resolve(
  import.meta.dirname,
  '../../node_modules/@types/react',
);

// A component file in the shape of packages/ui: a cva() call, defaults and a
// per-variant default table. `cva` is a local stand-in; the guard reads the
// call's syntax only.
const thing = `
import React from 'react';

function cva(_base: string, _config: unknown) {
  return (_props: unknown) => '';
}

const thingVariants = cva('', {
  variants: {
    tone: { plain: '', loud: '', quiet: '' },
    colour: { grey: '', red: '', blue: '', green: '' },
    size: { sm: '', md: '', lg: '' },
    round: { true: '', false: '' },
  },
  defaultVariants: { tone: 'plain', colour: 'grey', size: 'md', round: false },
});

/**
 * Colours per tone; the first is the default.
 * @variantDefaults colour by tone
 */
const colours = {
  plain: ['grey', 'red'],
  loud: ['blue'],
  quiet: ['green'],
} as const;

export type ThingSize = 'sm' | 'md' | 'lg';
export type ThingLook = {
  tone?: 'plain' | 'loud' | 'quiet';
  colour?: 'grey' | 'red' | 'blue' | 'green';
  size?: ThingSize;
  round?: boolean;
};

export function thingClassName(look: ThingLook) {
  return thingVariants(look) + String(colours);
}

export function Thing(props: ThingLook & { children?: React.ReactNode }) {
  return <span className={thingClassName(props)}>{props.children}</span>;
}
`;

const group = `
import React from 'react';
import type { ThingSize } from './Thing';

export function ThingGroup(props: { size?: ThingSize; children?: React.ReactNode }) {
  return <div>{props.children}</div>;
}
`;

function makeRepo(t: TestContext, app: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-variants-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files: Record<string, string> = {
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        jsx: 'react',
        strict: true,
        module: 'ESNext',
        moduleResolution: 'Bundler',
        baseUrl: '.',
        paths: { react: [path.join(reactTypes, 'index.d.ts')] },
        types: [],
      },
    }),
    'packages/ui/src/components/Thing.tsx': thing,
    'packages/ui/src/components/ThingGroup.tsx': group,
    ...app,
  };
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  return root;
}

const imports = `
import React from 'react';
import { Thing, thingClassName } from '../../../packages/ui/src/components/Thing';
import { ThingGroup } from '../../../packages/ui/src/components/ThingGroup';
`;

const unused = (root: string) =>
  analyze(root)
    .map(({ variant, value }) => `${variant}=${value}`)
    .sort();

test('lists every value app code never uses', t => {
  const root = makeRepo(t, {
    'modules/a/client/A.tsx': `${imports}
export const A = () => <Thing>Text</Thing>;
`,
  });
  assert.deepEqual(unused(root), [
    'colour=blue',
    'colour=green',
    'colour=red',
    'round=true',
    'size=lg',
    'size=sm',
    'tone=loud',
    'tone=quiet',
  ]);
});

test('counts literals, typed expressions, flags, objects and groups', t => {
  const root = makeRepo(t, {
    'modules/a/client/A.tsx': `${imports}
type Status = 'loud' | 'quiet';
export const A = ({ status }: { status: Status }) => (
  <ThingGroup size="lg">
    <Thing tone={status} colour="blue" round>One</Thing>
    <Thing colour="red">Two</Thing>
    <span className={thingClassName({ size: 'sm' })} />
  </ThingGroup>
);
`,
  });
  // Every Thing names its colour, so no default colour is used: grey (plain's
  // default) stays unused, as does green, which nothing passes.
  assert.deepEqual(unused(root), ['colour=green', 'colour=grey']);
});

test('applies per-variant defaults and ignores tests', t => {
  const root = makeRepo(t, {
    'modules/a/client/A.tsx': `${imports}
export const A = () => (
  <>
    <Thing tone="quiet" size="sm">One</Thing>
    <Thing tone="loud" size="lg" round colour="red">Two</Thing>
  </>
);
`,
    'modules/a/tests/client/A.test.tsx': `${imports}
export const T = () => <Thing colour="blue">Test</Thing>;
`,
  });
  // The quiet Thing uses quiet's default colour, green. Every Thing names its
  // tone and size, so their defaults stay unused. The test file's blue does
  // not count.
  assert.deepEqual(unused(root), [
    'colour=blue',
    'colour=grey',
    'size=md',
    'tone=plain',
  ]);
});
