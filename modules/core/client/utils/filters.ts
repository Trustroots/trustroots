export const plainText = (html: unknown): string => {
  if (
    !html ||
    typeof html !== 'string' ||
    typeof document === 'undefined' ||
    typeof document.createElement !== 'function'
  ) {
    return '';
  }
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.textContent || '';
};

export const plainTextLength = (html: unknown): number =>
  plainText(html).trim().length;
