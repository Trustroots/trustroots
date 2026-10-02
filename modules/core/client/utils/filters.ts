export const plainText = (html: unknown): string => {
  if (
    !html ||
    typeof html !== 'string' ||
    typeof document === 'undefined' ||
    typeof document.createElement !== 'function'
  ) {
    return '';
  }
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

export const plainTextLength = (html: unknown): number =>
  plainText(html).trim().length;
