import { createRequire } from 'node:module';

import _ from 'lodash';
import fs from 'fs';
import { globSync } from 'node:fs';
import defaultAssets from './assets/default.mts';
import defaultConfig from './env/default.mts';
import developmentConfig from './env/development.mts';
import productionConfig from './env/production.mts';
import testConfig from './env/test.mts';
import { applyMailSafety } from './lib/mail-safety.mts';
import type {
  Config,
  ConfigOverrides,
  DatabaseConfig,
  DeepPartial,
} from './types.mts';

type Environment = 'development' | 'production' | 'test';
type EnvironmentConfig = ConfigOverrides & { db: DatabaseConfig };
const environmentConfigByName: Record<Environment, EnvironmentConfig> = {
  development: developmentConfig,
  production: productionConfig,
  test: testConfig,
};
// Existing deployment-owned local.js is CommonJS under config/package.json.
const requireLocalConfig = createRequire(import.meta.url);
/**
 * Module dependencies.
 */

/**
 * Get files by glob patterns
 */
const getGlobbedPaths = function (
  globPatterns: string | string[],
  excludes?: string | string[],
): string[] {
  // URL paths regex
  const urlRegex = new RegExp('^(?:[a-z]+:)?//', 'i');

  // The output array
  let output: string[] = [];

  // If glob pattern is array so we use each pattern in a recursive way, otherwise we use glob
  if (_.isArray(globPatterns)) {
    globPatterns.forEach(function (globPattern) {
      output = _.union(output, getGlobbedPaths(globPattern, excludes));
    });
  } else if (_.isString(globPatterns)) {
    if (urlRegex.test(globPatterns)) {
      output.push(globPatterns);
    } else {
      let files = globSync(globPatterns).sort();
      if (excludes) {
        files = files.map(function (file) {
          if (_.isArray(excludes)) {
            for (const i in excludes) {
              if (_.has(excludes, i)) {
                const exclude = excludes[i];
                if (exclude !== undefined) file = file.replace(exclude, '');
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
const validateEnvironmentVariable = function (): void {
  const environmentFiles = process.env.NODE_ENV
    ? environmentConfigByName[
        process.env.NODE_ENV as keyof typeof environmentConfigByName
      ]
    : undefined;
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
const getGlobalConfigFiles = (
  assets: typeof defaultAssets,
): Config['files'] => ({
  server: {
    models: getGlobbedPaths(assets.server.models),
    routes: getGlobbedPaths(assets.server.routes),
    configs: getGlobbedPaths(assets.server.config),
    policies: getGlobbedPaths(assets.server.policies),
  },
});

/**
 * Initialize global configuration
 */
const initGlobalConfig = function (): Config {
  // Validate NDOE_ENV existance
  validateEnvironmentVariable();

  const environment = process.env
    .NODE_ENV as keyof typeof environmentConfigByName;

  /**
   * Resolve environment configuration by extending each env configuration file,
   * and lastly merge/override that with any local repository configuration that exists
   * in local.js
   */
  const config = _.merge(
    _.extend(defaultConfig, environmentConfigByName[environment]),
    (!process.env.TRUSTROOTS_SKIP_LOCAL_CONFIG &&
      fs.existsSync('./config/env/local.js') &&
      (requireLocalConfig('./env/local.js') as DeepPartial<Config>)) ||
      {},
  );

  applyMailSafety(config, process.env);
  return Object.assign(config, {
    files: getGlobalConfigFiles(defaultAssets),
    utils: { getGlobbedPaths },
  });
};

/**
 * Set configuration object
 */
const service: Config = initGlobalConfig();
export default service;
/** @commonjs */
export { service as 'module.exports' };
