import type { Express } from 'express';
import type { Connection } from 'mongoose';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import config from '../../config/config.mts';

export async function loadModuleModels() {
  for (const modelPath of config.files.server.models) {
    await import(pathToFileURL(resolve(modelPath)).href);
  }
}

/**
 * Invoke modules server configuration
 */
export async function initModulesConfiguration(app: Express, db?: Connection) {
  for (const configPath of config.files.server.configs) {
    const { default: configure } = await import(
      pathToFileURL(resolve(configPath)).href
    );
    await configure(app, db);
  }
}

/**
 * Configure the modules server routes
 */
export async function initModulesServerRoutes(app: Express) {
  // Discovery puts core routes last, including its catch-all.
  for (const routePath of config.files.server.routes) {
    const { default: routes } = await import(
      pathToFileURL(resolve(routePath)).href
    );
    routes(app);
  }
}
