import DOMPurify from 'dompurify';
import {
  richTextTags,
  richTextAttributes,
  richTextLinkSchemes,
} from '../../shared/rich-text-policy.mts';

// Retain relative links as well as the server formatter's explicit schemes.
const allowedUri = new RegExp(
  `^(?:(?:${richTextLinkSchemes.join('|')}):|[^a-z]|[a-z+.\\-]+(?:[^a-z+.\\-:]|$))`,
  'i',
);

export function sanitiseRichText(content: string): string {
  const fragment = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: richTextTags,
    ALLOWED_ATTR: [],
    ADD_ATTR: (attribute, tag) =>
      richTextAttributes[tag]?.includes(attribute) === true,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: allowedUri,
    RETURN_DOM_FRAGMENT: true,
  });

  const template = document.createElement('template');
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
    if (allowTrustrootsLinks) {
      try {
        const href = link.getAttribute('href');
        if (href) {
          const url = new URL(href, window.location.href);
          if (
            ['http:', 'https:'].includes(url.protocol) &&
            (url.origin === window.location.origin ||
              ['trustroots.org', 'www.trustroots.org'].includes(url.hostname))
          ) {
            continue;
          }
        }
      } catch {
        // Invalid destinations remain plain text.
      }
    }
    link.replaceWith(...Array.from(link.childNodes));
  }

  return template.innerHTML;
}
