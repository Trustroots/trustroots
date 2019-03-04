import sanitizeHtmlFunction from 'sanitize-html';
import textService from './modules/core/server/services/text.server.service';

export const limitTo = (text, length) => {
  return text.substring(0, length);
};

export const plainTextLength = (text) => {
  return text && typeof(text) === 'string' ? String(text).replace(/&nbsp;/g, ' ').replace(/<[^>]+>/gm, '').trim().length : 0; // eslint-disable-line angular/typecheck-string
};

export const sanitizeHtml = (text) => {
  return sanitizeHtmlFunction(text, textService.sanitizeOptions);
};
