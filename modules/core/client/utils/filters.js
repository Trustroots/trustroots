export const limitTo = (text, length) => {
  return text.substring(0, length);
};

export const plainText = html => {
  if (!html || typeof html !== 'string' || typeof document === 'undefined') {
    return '';
  }
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

export const plainTextLength = html => {
  return plainText(html).trim().length;
};
