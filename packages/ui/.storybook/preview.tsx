import React from 'react';
import type { Decorator, Preview } from '@storybook/react-vite';

// The app's stylesheets in the app's order: Bootstrap, the global Less with
// the `--tr-*` tokens, Tailwind with this package's theme, then module Less.
import '../../../config/vite/load-styles.ts';

/** Sets the writing direction, so logical properties can be checked in RTL. */
const withDirection: Decorator = (Story, { globals }) => {
  const dir = globals.direction === 'rtl' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  return (
    <div dir={dir}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withDirection],
  globalTypes: {
    direction: {
      description: 'Writing direction',
      toolbar: {
        title: 'Direction',
        icon: 'transfer',
        items: [
          { value: 'ltr', title: 'Left to right' },
          { value: 'rtl', title: 'Right to left' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { direction: 'ltr' },
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    // Contrast and other checks show in the Accessibility panel; they report
    // but do not fail the story tests.
    a11y: { test: 'todo' },
  },
};

export default preview;
