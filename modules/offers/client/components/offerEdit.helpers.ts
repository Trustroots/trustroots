import DOMPurify from 'dompurify';

export function plainTextLength(value = ''): number {
  const fragment = DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    RETURN_DOM_FRAGMENT: true,
  });
  return (fragment.textContent || '').trim().length;
}
