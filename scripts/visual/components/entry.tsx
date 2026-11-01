// Renders every fixture's `before` or `after` side, chosen by `?side=`. The
// page has no stylesheet of its own: index.html links the app stylesheet of
// the branch being shot.
import React, { type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

import type { FixtureText } from './fixture.ts';
import { fixtures } from './fixtures/index.ts';

const params = new URLSearchParams(location.search);
const side = params.get('side') === 'before' ? 'before' : 'after';
const only = params.get('only');
const rtl = document.documentElement.dir === 'rtl';

const text: FixtureText = rtl
  ? {
      label: 'حفظ التغييرات',
      short: 'جديد',
      sentence: 'حدث خطأ ما. حاول مرة أخرى.',
    }
  : {
      label: 'Save changes',
      short: 'New',
      sentence: 'Snap! Something went wrong.',
    };

function Shot({
  id,
  width,
  children,
}: {
  id: string;
  width?: number;
  children: ReactNode;
}) {
  // The padding leaves room for focus outlines and box shadows. Each shot
  // sits in its own row so a size change cannot move the next one.
  return (
    <div style={{ margin: 4 }}>
      <div
        data-shot={id}
        style={{
          display: width ? 'block' : 'inline-block',
          width,
          padding: 8,
          background: '#fff',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Fixtures() {
  return (
    <div style={{ padding: 16 }}>
      {fixtures
        .filter(fixture => !only || fixture.id === only)
        .map(fixture => (
          <Shot key={fixture.id} id={fixture.id} width={fixture.width}>
            {fixture[side](text)}
          </Shot>
        ))}
    </div>
  );
}

// The shooter reads the list, with each fixture's states and target, from here.
(window as unknown as { __fixtures: unknown }).__fixtures = fixtures.map(
  fixture => ({
    id: fixture.id,
    states: fixture.states ?? ['rest'],
    target: fixture.target ?? 'button, a, [role="button"]',
  }),
);

createRoot(document.getElementById('root')!).render(<Fixtures />);
