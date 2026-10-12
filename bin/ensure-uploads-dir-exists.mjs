#!/usr/bin/env node

/**
 * Ensure uploads directory exists
 */
import config from './../config/config.mjs';
import fs from 'fs';
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdir(
    config.uploadDir,
    {
      recursive: true,
    },
    err => {
      if (err) {
        console.error(err);
      }
    },
  );
}
