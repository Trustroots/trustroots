import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { act } from 'react-dom/test-utils';

import LanguageSwitch from './LanguageSwitch.component';

import i18n from '@/config/client/i18n';
i18n
  .init({
    resources: {
      en: {}
    }
  });

let container = null;
beforeEach(() => {
  // setup a DOM element as a render target
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  // cleanup on exiting
  unmountComponentAtNode(container);
  container.remove();
  container = null;
});

it('has a menu item for each language', async () => {
  await act(async () => render(<LanguageSwitch />, container));
  const entries = [...container.querySelectorAll('a[role="menuitem"')];
  expect(entries.length).toBe(3);
  const names = entries.map(el => el.innerHTML);
  expect(names).toEqual(['English', 'česky', 'suomi']);
});
