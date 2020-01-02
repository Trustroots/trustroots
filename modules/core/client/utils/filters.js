export const plainText = (html) => {
  if (!html || typeof(html) !== 'string' || !document) {
    return '';
  }
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

export const plainTextLength = (html) => {
  return plainText(html).trim().length;
};
