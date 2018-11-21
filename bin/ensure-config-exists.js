#!/usr/bin/env node

/**
 * Ensure config file exists by copying it from template file if it doesn't exist.
 */

const { constants, copyFile, existsSync } = require('fs');
const { COPYFILE_EXCL } = constants;

const configTemplate = './config/env/local.sample.js';
const config = './config/env/local.js';

if (!existsSync(config)) {
  copyFile(configTemplate, config, COPYFILE_EXCL, (err) => {
    if (err) {
      console.error(`Could not create a config file at ${ config }`);
      throw err;
    }
    console.log(`Created a config file at ${ config }`);
  });
}
