/**
 * Module dependencies.
 */
const _ = require('lodash');
const fs = require('fs');
const chalk = require('chalk');
const glob = require('glob');
const path = require('path');

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
  const environmentFiles = glob.sync(`./config/env/${process.env.NODE_ENV}.js`);

  console.log();
  if (!environmentFiles.length) {
    if (process.env.NODE_ENV) {
      console.error(
        chalk.red(
          `No configuration file found for "${process.env.NODE_ENV}" environment using development instead`,
        ),
      );
    } else {
      console.error(
        chalk.red(
          'NODE_ENV is not defined! Using default development environment',
        ),
      );
    }
    process.env.NODE_ENV = 'development';
  } else {
    console.log(
      chalk.bold(`Loaded "${process.env.NODE_ENV}" environment configuration`),
    );
  }
  // Reset console color
  console.log(chalk.white(''));
};

/**
 * Initialize global configuration files
 */
const initGlobalConfigFolders = function (config) {
  // Appending files
  config.folders = {
    server: {},
  };
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
  const defaultAssets = require(path.join(
    process.cwd(),
    'config/assets/default',
  ));

  // Get the current assets
  const environmentAssets =
    require(path.join(process.cwd(), 'config/assets/', process.env.NODE_ENV)) ||
    {};

  // Merge assets
  const assets = _.extend(defaultAssets, environmentAssets);

  /**
   * Resolve environment configuration by extending each env configuration file,
   * and lastly merge/override that with any local repository configuration that exists
   * in local.js
   */
  let config = _.extend(
    require(path.join(process.cwd(), 'config/env/default')),
    require(path.join(process.cwd(), 'config/env/', process.env.NODE_ENV)) ||
      {},
  );
  config = _.merge(
    config,
    (fs.existsSync('./config/env/local.js') && require('./env/local.js')) || {},
  );

  // Initialize global globbed files
  initGlobalConfigFiles(config, assets);

  // Initialize global globbed folders
  initGlobalConfigFolders(config, assets);

  // Expose configuration utilities
  config.utils = {
    getGlobbedPaths,
  };

  return config;
};

/**
 * Set configuration object
 */
module.exports = initGlobalConfig();
