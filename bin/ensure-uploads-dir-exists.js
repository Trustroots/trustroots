#!/usr/bin/env node

/**
 * Ensure uploads directory exists
 */

const config = require('../config/config');
const fs = require('fs');

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdir(config.uploadDir, { recursive: true }, err => {
    if (err) {
      console.error(err);
    }
  });
}
