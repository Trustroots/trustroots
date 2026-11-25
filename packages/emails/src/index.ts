import { createRequire } from 'node:module';
import { createElement } from 'react';
import { render, toPlainText } from 'react-email';
import './jsx-loader.ts';
import type { MessagesUnreadProps } from './templates/messages-unread.tsx';

// Load the templates only once the JSX loader is registered, so not with a
// static import (linked before any module runs) or top-level await (CommonJS
// code still requires modules that import this package).
const { htmlEmails, textEmails } = createRequire(import.meta.url)(
  './registry.ts',
) as typeof import('./registry.ts');

interface PlainTextNode {
  children?: PlainTextNode[];
}

interface PlainTextBuilder {
  openBlock(options: { isPre: boolean; leadingLineBreaks: number }): void;
  addInline(text: string): void;
  closeBlock(options: { trailingLineBreaks: number }): void;
}

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
  if (name !== 'messages-unread') return { html, text: toPlainText(html) };

  let index = 0;
  const { messages } = props as MessagesUnreadProps;
  const text = toPlainText(html, {
    selectors: [{ selector: '.unread-message-content', format: 'messageBody' }],
    formatters: {
      messageBody(
        element: PlainTextNode,
        walk: (nodes: PlainTextNode[], builder: PlainTextBuilder) => void,
        builder: PlainTextBuilder,
      ) {
        const content = messages[index++]?.plainText;
        builder.openBlock({
          isPre: content !== undefined,
          leadingLineBreaks: 2,
        });
        if (content === undefined) {
          walk(element.children ?? [], builder);
        } else {
          builder.addInline(content);
        }
        builder.closeBlock({ trailingLineBreaks: 2 });
      },
    },
  });
  return { html, text };
}
