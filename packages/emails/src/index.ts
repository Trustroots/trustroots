import { createRequire } from 'node:module';
import { createElement } from 'react';
import { render, toPlainText } from 'react-email';
import './jsx-loader.ts';

// Load the templates only once the JSX loader is registered, so not with a
// static import (linked before any module runs) or top-level await (CommonJS
// code still requires modules that import this package).
const { htmlEmails, textEmails } = createRequire(import.meta.url)(
  './registry.ts',
) as typeof import('./registry.ts');

export interface RenderedEmail {
  html?: string;
  text: string;
}

/** Render an email by name: HTML with its plain text, or plain text only. */
export async function renderEmail(
  name: string,
  props: object,
): Promise<RenderedEmail> {
  const Email = htmlEmails[name];
  if (!Email) {
    const text = textEmails[name];
    if (!text) throw new Error(`Unknown email: ${name}`);
    return { text: text(props as never) };
  }
  // React separates adjacent text nodes with empty comments.
  const html = (await render(createElement(Email, props as never))).replaceAll(
    '<!-- -->',
    '',
  );
  return { html, text: toPlainText(html) };
}
