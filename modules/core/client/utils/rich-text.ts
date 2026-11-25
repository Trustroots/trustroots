import DOMPurify from 'dompurify';
import { findHashtagLinks } from './hashtag-links';
import {
  richTextTags,
  messageRichTextTags,
  messageLineBlockTags,
  normaliseMessageSourceNewlines,
  richTextAttributes,
  richTextLinkSchemes,
} from '../../shared/rich-text-policy.mts';
import { trustrootsLink } from '../../shared/trustroots-links.mts';

// Retain relative links as well as the server formatter's explicit schemes.
const allowedUri = new RegExp(
  `^(?:(?:${richTextLinkSchemes.join('|')}):|[^a-z]|[a-z+.\\-]+(?:[^a-z+.\\-:]|$))`,
  'i',
);

export function sanitiseRichText(
  content: string,
  messageFormatting = false,
): string {
  const fragment = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: messageFormatting ? messageRichTextTags : richTextTags,
    ALLOWED_ATTR: [],
    ADD_ATTR: (attribute, tag) =>
      richTextAttributes[tag]?.includes(attribute) === true,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: allowedUri,
    RETURN_DOM_FRAGMENT: true,
  });

  const template = document.createElement('template');
  if (messageFormatting) {
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
    const lines: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.data.includes('\n')) lines.push(node);
    }
    for (const node of lines) {
      const content = normaliseMessageSourceNewlines(
        node.data,
        node.previousSibling?.nodeName.toLowerCase(),
        node.nextSibling?.nodeName.toLowerCase(),
      );
      node.replaceWith(
        ...content
          .split('\n')
          .flatMap((line, index) =>
            index ? [document.createElement('br'), line] : [line],
          ),
      );
    }
    const lineBoundarySelector = ['br', ...messageLineBlockTags].join(',');
    for (const block of fragment.querySelectorAll('p, div')) {
      if (
        !block.textContent?.trim() &&
        !block.querySelector(lineBoundarySelector)
      ) {
        block.append(document.createElement('br'));
      }
    }
  }
  template.content.append(fragment);
  return template.innerHTML;
}

/** Remove clickable destinations from already sanitised user-written HTML. */
export function disableUserContentLinks(
  content: string,
  allowTrustrootsLinks = false,
): string {
  const template = document.createElement('template');
  template.innerHTML = content;

  for (const link of Array.from(template.content.querySelectorAll('a'))) {
    if (
      allowTrustrootsLinks &&
      trustrootsLink(link.getAttribute('href') ?? '', window.location.href)
    ) {
      continue;
    }
    link.replaceWith(...Array.from(link.childNodes));
  }

  return template.innerHTML;
}

/** Turn inline HTTP(S) Markdown links in sanitised text into anchors. */
export function linkMarkdown(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_TEXT,
  );
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  const markdownLink =
    /(?<![!\\])\[([^[\]\r\n]+)\]\((https?:\/\/(?:[^\s<>()\\]|\([^\s<>()\\]*\))+)\)/gi;
  for (const node of textNodes) {
    if (node.parentElement?.closest('a')) continue;
    const replacement = document.createDocumentFragment();
    let offset = 0;
    for (const match of node.data.matchAll(markdownLink)) {
      const [source, label, href] = match;
      if (!URL.canParse(href)) continue;
      const link = document.createElement('a');
      link.setAttribute('href', href);
      link.textContent = label;
      replacement.append(node.data.slice(offset, match.index), link);
      offset = match.index + source.length;
    }
    if (offset) {
      replacement.append(node.data.slice(offset));
      node.replaceWith(replacement);
    }
  }

  return template.innerHTML;
}

/** Add links from an application-provided map to already sanitised HTML. */
export function linkHashtags(
  html: string,
  links: ReadonlyMap<string, string>,
): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_TEXT,
  );
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  for (const node of textNodes) {
    if (node.parentElement?.closest('a')) continue;
    const replacement = document.createDocumentFragment();
    let offset = 0;
    for (const { label, href, start, end } of findHashtagLinks(
      node.data,
      links,
    )) {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      replacement.append(node.data.slice(offset, start), link);
      offset = end;
    }
    if (offset) {
      replacement.append(node.data.slice(offset));
      node.replaceWith(replacement);
    }
  }

  return template.innerHTML;
}
