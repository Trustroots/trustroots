const has = require('lodash/has');

/**
 * Rules for sanitizing texts coming in and out
 * - messages
 * - hosting descriptions
 * - user descriptions
 *
 * @link https://github.com/punkave/sanitize-html
 */
exports.sanitizeOptions = {
  allowedTags: [
    'p',
    'br',
    'b',
    'i',
    'em',
    'strong',
    'u',
    'a',
    'li',
    'ul',
    'blockquote'
  ],
  allowedAttributes: {
    'a': ['href'],
    // Used for messages text
    // at `modules/messages/client/controllers/thread.client.controller.js`
    'p': ['data-hosting']
  },
  // If we would allow class attributes, you can limit which classes are allowed:
  // allowedClasses: {
  //   'a': [ 'classname' ]
  // },
  // Convert these tags to unify html
  transformTags: {
    'strong': 'b',
    'em': 'i'
  },
  exclusiveFilter: function (frame) {
    // Don't allow empty <a> tags, such as:
    // - `<a href="http://trustroots.org"></a>`
    // - `<a>http://trustroots.org</a>`
    if (frame.tag === 'a' && (!frame.text.trim() || !has(frame, 'attribs.href'))) {
      return true;
    }

    return false;
  },
  selfClosing: ['br'],
  // URL schemes we permit
  allowProtocolRelative: true, // Allows `//www.example.com`
  allowedSchemesByTag: {
    a: [
      'http',
      'https',
      'ftp',
      'sftp',
      'tel',
      'mailto',
      'geo',
      'irc',
      'ge0', // Maps.me
      'tg' // Telegram
    ]
  }
};
