// const sanitizeHtmlFunction = require('sanitize-html');
// const textService = require('../core/server/services/text.server.service');

export const limitTo = (text, length) => {
  return text.substring(0, length);
};

export const plainTextLength = (text) => {
  return text && typeof(text) === 'string' ? String(text).replace(/&nbsp;/g, ' ').replace(/<[^>]+>/gm, '').trim().length : 0; // eslint-disable-line angular/typecheck-string
};

export const sanitizeHtml = (text) => {
  // TODO solve a problem with sanitize html
  return text;
  // return sanitizeHtmlFunction(text, textService.sanitizeOptions);
};
