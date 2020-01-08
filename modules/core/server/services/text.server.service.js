/**
 * Module dependencies.
 */
const _ = require('lodash');
const Autolinker = require('autolinker');
const sanitizeHtml = require('sanitize-html');
const he = require('he');

/**
 * Rules for sanitizing texts coming in and out
 * - messages
 * - hosting descriptions
 * - user descriptions
 *
 * @link https://github.com/punkave/sanitize-html
 */
exports.sanitizeOptions = require(path.resolve('@/config/shared/sanitize'));


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
exports.html = function (content) {

  // @link https://lodash.com/docs/4.17.4#toString
  content = _.toString(content);

  // Don't bother with empty strings
  if (!content) {
    return '';
  }

  // Replace "&nbsp;", "<p><br></p>" and trim
  // This will catch most of the actually empty strings
  content = content.replace(/&nbsp;/g, ' ').replace(/<p><br><\/p>/g, ' ').trim();

  if (!content || exports.isEmpty(content)) {
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
  content = sanitizeHtml(content, exports.sanitizeOptions);

  return content;
};


/**
 * Check if string has content even when html and whitespace is stripped away
 *
 * @link https://lodash.com/docs/#isEmpty
 *
 * @param {String} value - String to be evaluated
 * @return {Boolean} `true` when empty, `false` when it has content.
 */
exports.isEmpty = function (value) {
  return _.isEmpty(exports.plainText(value));
};


/**
 * Strip all HTML tags and html entities out of a text
 *
 * @link https://github.com/punkave/sanitize-html
 * @param {String} content - Content to be stripped from html
 * @param {Boolean} cleanWhitespace
 * @returns {String}
 */
exports.plainText = function (content, cleanWhitespace) {

  // Force string
  // @link https://lodash.com/docs/4.17.4#toString
  content = _.toString(content);

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
  content = sanitizeHtml(content, { allowedTags: [] });
  content = he.decode(content);

  // Remove white space.
  // Matches a single white space character, including space, tab, form feed, line feed.
  if (cleanWhitespace === true) {
    content = content.replace(/\s/g, ' ');
  }

  // Trim
  content = content.trim();

  return content;
};
