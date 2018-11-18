#!/usr/bin/env node

/**
 * Ensure uploads directory exists
 */

const config = require('../config/config');
const fs = require('fs');
const mkdirRecursive = require('mkdir-recursive');

if (!fs.existsSync(config.uploadDir)) {
  mkdirRecursive.mkdir(config.uploadDir, (err) => {
    if (err) {
      console.error(err);
    }
  });
}
