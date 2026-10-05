import { createRequire } from 'node:module';

import _ from 'lodash';
import fs from 'fs';
import glob from 'glob';
import defaultAssets from './assets/default.mjs';
import developmentAssets from './assets/development.mjs';
import productionAssets from './assets/production.mjs';
import testAssets from './assets/test.mjs';
import defaultConfig from './env/default.mjs';
import developmentConfig from './env/development.mjs';
import productionConfig from './env/production.mjs';
import testConfig from './env/test.mjs';
const environmentAssetsByName = {
  development: developmentAssets,
  production: productionAssets,
  test: testAssets,
};
const environmentConfigByName = {
  development: developmentConfig,
  production: productionConfig,
  test: testConfig,
};
// Existing deployment-owned local.js is CommonJS under config/package.json.
const requireLocalConfig = createRequire(import.meta.url);
let service = {};
/**
 * Module dependencies.
 */

/**
 * Get files by glob patterns
 */
const getGlobbedPaths = function (globPatterns, excludes) {
  // URL paths regex
  const urlRegex = new RegExp('^(?:[a-z]+:)?//', 'i');

  // The output array
  let output = [];

  // If glob pattern is array so we use each pattern in a recursive way, otherwise we use glob
  if (_.isArray(globPatterns)) {
    globPatterns.forEach(function (globPattern) {
      output = _.union(output, getGlobbedPaths(globPattern, excludes));
    });
  } else if (_.isString(globPatterns)) {
    if (urlRegex.test(globPatterns)) {
      output.push(globPatterns);
    } else {
      let files = glob.sync(globPatterns);
      if (excludes) {
        files = files.map(function (file) {
          if (_.isArray(excludes)) {
            for (const i in excludes) {
              if (_.has(excludes, i)) {
                file = file.replace(excludes[i], '');
              }
            }
          } else {
            file = file.replace(excludes, '');
          }
          return file;
        });
      }
      output = _.union(output, files);
    }
  }
  return output;
};

/**
 * Validate NODE_ENV existance
 */
const validateEnvironmentVariable = function () {
  const environmentFiles = environmentConfigByName[process.env.NODE_ENV];
  console.log();
  if (!environmentFiles) {
    if (process.env.NODE_ENV) {
      console.error(
        `No configuration file found for "${process.env.NODE_ENV}" environment using development instead`,
      );
    } else {
      console.error(
        'NODE_ENV is not defined! Using default development environment',
      );
    }
    process.env.NODE_ENV = 'development';
  } else {
    console.log(`Loaded "${process.env.NODE_ENV}" environment configuration`);
  }
};

/**
 * Initialize global configuration files
 */
const initGlobalConfigFiles = function (config, assets) {
  // Appending files
  config.files = {
    server: {},
  };

  // Setting Globbed model files
  config.files.server.models = getGlobbedPaths(assets.server.models);

  // Setting Globbed route files
  config.files.server.routes = getGlobbedPaths(assets.server.routes);

  // Setting Globbed config files
  config.files.server.configs = getGlobbedPaths(assets.server.config);

  // Setting Globbed policies files
  config.files.server.policies = getGlobbedPaths(assets.server.policies);
};

/**
 * Initialize global configuration
 */
const initGlobalConfig = function () {
  // Validate NDOE_ENV existance
  validateEnvironmentVariable();

  // Get the default assets

  // Get the current assets
  const environmentAssets = environmentAssetsByName[process.env.NODE_ENV] || {};

  // Merge assets
  const assets = _.extend(defaultAssets, environmentAssets);

  /**
   * Resolve environment configuration by extending each env configuration file,
   * and lastly merge/override that with any local repository configuration that exists
   * in local.js
   */
  let config = _.extend(
    defaultConfig,
    environmentConfigByName[process.env.NODE_ENV] || {},
  );
  config = _.merge(
    config,
    (!process.env.TRUSTROOTS_SKIP_LOCAL_CONFIG &&
      fs.existsSync('./config/env/local.js') &&
      requireLocalConfig('./env/local.js')) ||
      {},
  );

  // Initialize global globbed files
  initGlobalConfigFiles(config, assets);

  // Expose configuration utilities
  config.utils = {
    getGlobbedPaths,
  };
  return config;
};

/**
 * Set configuration object
 */
service = initGlobalConfig();
export default service;
export { service as 'module.exports' };
