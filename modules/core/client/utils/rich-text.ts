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

export function sanitiseRichText(
  content: string,
  internalLinksOnly = false,
): string {
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

  if (internalLinksOnly) {
    for (const link of Array.from(fragment.querySelectorAll('a'))) {
      let internal = false;
      try {
        const href = link.getAttribute('href');
        if (href) {
          const url = new URL(href, window.location.href);
          internal =
            ['http:', 'https:'].includes(url.protocol) &&
            url.origin === window.location.origin;
        }
      } catch {
        // An invalid destination cannot be an internal link.
      }
      if (!internal) link.replaceWith(...Array.from(link.childNodes));
    }
  }

  const template = document.createElement('template');
  template.content.append(fragment);
  return template.innerHTML;
}
