/**
 * Module dependencies.
 */
import _ from 'lodash';
import { Autolinker } from 'autolinker';
import sanitizeHtml, { type SanitizeOptions } from 'sanitize-html';
import * as he from 'he';
import {
  richTextTags,
  richTextAttributes,
  richTextLinkSchemes,
} from '../../shared/rich-text-policy.mts';

/**
 * Rules for sanitizing texts coming in and out
 * - messages
 * - hosting descriptions
 * - user descriptions
 *
 * @link https://github.com/punkave/sanitize-html
 */
export const sanitizeOptions: SanitizeOptions = {
  allowedTags: richTextTags,
  allowedAttributes: richTextAttributes,
  // If we would allow class attributes, you can limit which classes are allowed:
  // allowedClasses: {
  //   'a': [ 'classname' ]
  // },
  // Convert these tags to unify html
  transformTags: {
    strong: 'b',
    em: 'i',
  },
  exclusiveFilter(frame) {
    // Don't allow empty <a> tags, such as:
    // - `<a href="http://trustroots.org"></a>`
    // - `<a>http://trustroots.org</a>`
    if (
      frame.tag === 'a' &&
      (!frame.text.trim() || !_.has(frame, 'attribs.href'))
    ) {
      return true;
    }
    return false;
  },
  selfClosing: ['br'],
  // URL schemes we permit
  allowProtocolRelative: true,
  // Allows `//www.example.com`
  allowedSchemesByTag: {
    a: richTextLinkSchemes,
  },
};

/**
 * - Sanitize html
 * - Fix glitches coming in sometimes from wysiwyg editors
 * - trim empty space from ends
 *
 * @link https://github.com/punkave/sanitize-html
 *
 * @param {String} content - String to be sanitized
 * @returns {String}
 */
export function html(value: unknown): string {
  // @link https://lodash.com/docs/4.17.4#toString
  let content = _.toString(value);

  // Don't bother with empty strings
  if (!content) {
    return '';
  }

  // Replace "&nbsp;", "<p><br></p>" and trim
  // This will catch most of the actually empty strings
  content = content
    .replace(/&nbsp;/g, ' ')
    .replace(/<p><br><\/p>/g, ' ')
    .trim();
  if (!content || isEmpty(content)) {
    // If content is actually empty without html (e.g. `<p><br></p>`)
    // Set it really to be empty string
    return '';
  }

  // Turn URLs/emails/phonenumbers into links
  // @link https://github.com/gregjacobs/Autolinker.js
  content = Autolinker.link(content, {
    // Don't auto-link mention handles (@username)
    mention: false,
    // Don't auto-link hashtags (#tag)
    hashtag: false,
    // Auto-link emails
    email: true,
    // Auto-link URLs
    urls: true,
    // Auto-link phone numbers
    phone: true,
    // A number for how many characters long URLs/emails/handles/hashtags should be truncated to
    // inside the text of a link. If the match is over the number of characters, it will be truncated to this length
    // by replacing the end of the string with a two period ellipsis ('..').
    truncate: {
      length: 150,
      location: 'middle', // end|middle|smart
    },
    // Strip 'http://' or 'https://' and/or the 'www.' from the beginning of links.
    // I.e.: `https://www.wikipedia.org/` => `<a href="https://www.wikipedia.org/">www.wikipedia.org</a>`
    stripPrefix: {
      scheme: true,
      www: false,
    },
    // Don't add target="_blank" because of rel-noopener attack.
    // @link https://mathiasbynens.github.io/rel-noopener/
    newWindow: false,
  });

  // Some html is allowed
  content = sanitizeHtml(content, sanitizeOptions);
  return content;
}

/**
 * Check if string has content even when html and whitespace is stripped away
 *
 * @link https://lodash.com/docs/#isEmpty
 *
 * @param {String} value - String to be evaluated
 * @return {Boolean} `true` when empty, `false` when it has content.
 */
export function isEmpty(value: unknown): boolean {
  return _.isEmpty(plainText(value));
}

/**
 * Strip all HTML tags and html entities out of a text
 *
 * @link https://github.com/punkave/sanitize-html
 * @param {String} content - Content to be stripped from html
 * @param {Boolean} cleanWhitespace
 * @returns {String}
 */
export function plainText(value: unknown, cleanWhitespace?: boolean): string {
  // Force string
  // @link https://lodash.com/docs/4.17.4#toString
  let content = _.toString(value);

  // Don't bother with empty strings
  if (!content) {
    return '';
  }

  // Replace HTML breaklines
  content = content.replace(/<br\s*[/]?>/gi, '\n');

  /*
   * Sanitize HTML tags AND HTML entities out
   * Decoding twice might look weird, but it's there for reason:
   * to stop html entity attacks.
   */
  content = he.decode(content);
  content = sanitizeHtml(content, {
    allowedTags: [],
  });
  content = he.decode(content);

  // Remove white space.
  // Matches a single white space character, including space, tab, form feed, line feed.
  if (cleanWhitespace === true) {
    content = content.replace(/\s/g, ' ');
  }

  // Trim
  content = content.trim();
  return content;
}

/**
 * Remove contact details from rich text without changing the stored content.
 *
 * @param {String} content - Content that may contain URLs, emails or phone numbers.
 * @returns {String} Plain text with detected contact details removed.
 */
export function stripContactDetails(value: unknown): string {
  let content = sanitizeHtml(_.toString(value), {
    allowedTags: sanitizeOptions.allowedTags,
    allowedAttributes: sanitizeOptions.allowedAttributes,
    exclusiveFilter(frame) {
      return (
        frame.tag === 'a' &&
        /^(?:(?:https?|s?ftp|mailto|tel):|\/\/)/i.test(
          _.get(frame, 'attribs.href', ''),
        )
      );
    },
  });
  content = plainText(content);
  if (!content) {
    return '';
  }
  return Autolinker.link(content, {
    email: true,
    hashtag: false,
    mention: false,
    phone: true,
    urls: true,
    replaceFn: () => '',
  });
}
const defaultInterop = {
  sanitizeOptions,
  html,
  isEmpty,
  plainText,
  stripContactDetails,
};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
