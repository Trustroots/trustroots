'use strict';

// Container-only overrides. This file is mounted over config/env/local.js so a
// developer's host configuration cannot redirect email outside the dev stack.
module.exports = {
  mailer: {
    options: {
      jsonTransport: false,
      host: 'mailpit',
      port: 1025,
      ignoreTLS: true,
      auth: false,
      pool: true,
    },
  },
};
