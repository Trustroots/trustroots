import { createRequire } from 'node:module';

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
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mergeDeep = <T extends object>(target: T, source: object): T => {
  for (const [key, value] of Object.entries(source)) {
    const current = Reflect.get(target, key);
    Reflect.set(
      target,
      key,
      isPlainObject(value) && isPlainObject(current)
        ? mergeDeep(current, value)
        : value,
    );
  }
  return target;
};

const getGlobbedPaths = function (
  globPatterns: string | string[],
  excludes?: string | string[],
): string[] {
  // URL paths regex
  const urlRegex = new RegExp('^(?:[a-z]+:)?//', 'i');

  // The output array
  let output: string[] = [];

  // If glob pattern is array so we use each pattern in a recursive way, otherwise we use glob
  if (Array.isArray(globPatterns)) {
    globPatterns.forEach(function (globPattern) {
      output = [
        ...new Set([...output, ...getGlobbedPaths(globPattern, excludes)]),
      ];
    });
  } else if (typeof globPatterns === 'string') {
    if (urlRegex.test(globPatterns)) {
      output.push(globPatterns);
    } else {
      let files = globSync(globPatterns).sort();
      if (excludes) {
        files = files.map(function (file) {
          if (Array.isArray(excludes)) {
            for (const exclude of excludes) {
              file = file.replace(exclude, '');
            }
          } else {
            file = file.replace(excludes, '');
          }
          return file;
        });
      }
      output = [...new Set([...output, ...files])];
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
const initGlobalConfig = function () {
  // Validate NDOE_ENV existance
  validateEnvironmentVariable();

  const environment = process.env
    .NODE_ENV as keyof typeof environmentConfigByName;

  /**
   * Resolve environment configuration by extending each env configuration file,
   * and lastly merge/override that with any local repository configuration that exists
   * in local.js
   */
  const config = mergeDeep(
    Object.assign(defaultConfig, environmentConfigByName[environment]),
    (!process.env.TRUSTROOTS_SKIP_LOCAL_CONFIG &&
      fs.existsSync('./config/env/local.js') &&
      (requireLocalConfig('./env/local.js') as DeepPartial<Config>)) ||
      {},
  );

  const mailMode = applyMailSafety(config, process.env);
  console.info(
    `[Mail] mode=${mailMode}${mailMode === 'capture' ? '; outgoing delivery disabled' : ''}`,
  );
  const service: Config = Object.assign(config, {
    files: getGlobalConfigFiles(defaultAssets),
    utils: { getGlobbedPaths },
  });
  return { service, mailMode };
};

/**
 * Set configuration object
 */
const { service, mailMode } = initGlobalConfig();
export { mailMode };
export default service;
