export const plainTextLength = (text) => {
  return text && typeof(text) === 'string' ? String(text).replace(/&nbsp;/g, ' ').replace(/<[^>]+>/gm, '').trim().length : 0; // eslint-disable-line angular/typecheck-string
};
