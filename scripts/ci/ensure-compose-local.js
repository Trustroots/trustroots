#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const localPath = path.join(__dirname, '../../deploy/docker/data/local.js');

if (fs.existsSync(localPath)) {
  process.exit(0);
}

fs.mkdirSync(path.dirname(localPath), { recursive: true });
fs.writeFileSync(
  localPath,
  `'use strict';

module.exports = {
  domain: 'localhost:8080',
  host: '0.0.0.0',
  db: {
    uri: 'mongodb://mongodb:27017/trustroots',
    checkCompatibility: false,
    autoIndex: true,
  },
  influxdb: {
    enabled: false,
  },
  mailer: {
    options: {
      host: 'maildev',
      port: 1025,
      ignoreTLS: true,
      auth: false,
      pool: true,
    },
  },
};
`,
);
