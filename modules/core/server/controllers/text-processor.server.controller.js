'use strict';

/**
 * Module dependencies.
 */
var Autolinker = require('autolinker'),
    sanitizeHtml = require('sanitize-html');

/**
 * Rules for sanitizing texts coming in and out
 * - messages
 * - hosting descriptions
 * - user descriptions
 *
 * @link https://github.com/punkave/sanitize-html
 */
exports.sanitizeOptions = {
  allowedTags: [ 'p', 'br', 'b', 'i', 'em', 'strong', 'u', 'a', 'li', 'ul', 'blockquote' ],
  allowedAttributes: {
    'a': [ 'href', 'target' ],
    // We don't currently allow img itself, but this would make sense if we did:
    //'img': [ 'src' ]
  },
  // If we would allow class attributes, you can limit which classes are allowed:
  //allowedClasses: {
  //  'a': [ 'classname' ]
  //},
  // Convert these tags to unify html
  transformTags: {
    'strong': 'b',
    'em': 'i'
  },
  // Don't allow empty <a> tags, such as: "<a href="http://trustroots.org"></a>"
  exclusiveFilter: function(frame) {
    return frame.tag === 'a' && !frame.text.trim();
  },
  selfClosing: [ 'img', 'br' ],
  // URL schemes we permit
  allowedSchemes: [ 'http', 'https', 'ftp', 'mailto', 'tel', 'irc' ]
};


/**
 * - Sanitize html
 * - Fix glitches coming in sometimes from wysiwyg editors
 * - trim empty space from ends
 *
 * @link https://github.com/punkave/sanitize-html
 */
exports.html = function (content) {

  if(typeof content === 'string' && content.length > 0) {

    // Replace "&nbsp;", "<p><br></p>" and trim
    content = content.replace(/&nbsp;/g, ' ').replace(/<p><br><\/p>/g, ' ').trim();

    // Some html is allowed at description
    content = sanitizeHtml(content, exports.sanitizeOptions);

    // Turn URLs/emails/phonenumbers into links
    // @link https://github.com/gregjacobs/Autolinker.js
    content = Autolinker.link(content, {
                twitter: false,
                truncate: 150
              });

  }

  return content;
};


/**
 * Check if string has content even when html and whitespace is stripped away
 *
 * @return boolean true when empty, false when it has content.
 */
exports.isEmpty = function (content) {
  return (
    typeof content !== 'string' ||
    content.length === 0 ||
    sanitizeHtml(content, {allowedTags: []}).replace(/&nbsp;/g, ' ').trim() === ''
  );
};


/**
 * Strip all HTML out of text
 *
 * @link https://github.com/punkave/sanitize-html
 */
exports.plainText = function (content, cleanWhitespace) {

  if(typeof content === 'string' && content.length > 0) {

    // No HTML allowed
    content = sanitizeHtml(content, {allowedTags: []});

    // Remove white space. Matches a single white space character, including space, tab, form feed, line feed.
    if(cleanWhitespace === true) {
      content = content.replace(/\s/g, ' ');
    }

    // Replace "&nbsp;" and trim
    content = content.replace(/&nbsp;/g, ' ').trim();

  }

  return content;
};
