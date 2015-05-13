'use strict';

/*
 * Copy this file to local.js and put your local changes there
 * Env settings will be overwritten by settings in this file.
 * 
 * Load order:
 * - default.js
 * - {development|production|test}.js
 * - local.js
 */

module.exports = {

  // See https://github.com/andris9/Nodemailer#tldr-usage-example how to configure mailer
  // In production we're using Mandrill https://mandrillapp.com
  /*
  mailer: {
    from: 'gmail.user@gmail.com',
    options: {
      service: 'Gmail',
      auth: {
        user: 'gmail.user@gmail.com',
        pass: 'userpass'
      }
    }
  }
  */
};
