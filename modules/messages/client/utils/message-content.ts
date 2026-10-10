export function disableExternalLinks(content: string): string {
  const template = document.createElement('template');
  template.innerHTML = content;

  for (const link of Array.from(template.content.querySelectorAll('a'))) {
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

  return template.innerHTML;
}
