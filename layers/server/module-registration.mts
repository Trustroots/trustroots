import type { Express } from 'express';
import type { Connection } from 'mongoose';
import { globSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import admin from '../../modules/admin/server/index.mts';
import contacts from '../../modules/contacts/server/index.mts';
import core from '../../modules/core/server/index.mts';
import experiences from '../../modules/experiences/server/index.mts';
import messages from '../../modules/messages/server/index.mts';
import mobile from '../../modules/mobile/server/index.mts';
import offers from '../../modules/offers/server/index.mts';
import pages from '../../modules/pages/server/index.mts';
import referencesThread from '../../modules/references-thread/server/index.mts';
import sparkpost from '../../modules/sparkpost/server/index.mts';
import statistics from '../../modules/statistics/server/index.mts';
import support from '../../modules/support/server/index.mts';
import tribes from '../../modules/tribes/server/index.mts';
import users from '../../modules/users/server/index.mts';

interface ServerModule {
  directory: string;
  models?: boolean;
  config?: boolean;
  routes?: boolean;
}

// Preserve the previous discovery order for model loading and configuration.
const modules: readonly ServerModule[] = [
  admin,
  contacts,
  core,
  experiences,
  messages,
  mobile,
  offers,
  pages,
  referencesThread,
  sparkpost,
  statistics,
  support,
  tribes,
  users,
];

// Core installs the catch-all, so its routes must be registered last.
const routeModules: readonly ServerModule[] = [
  ...modules.filter(module => module !== core),
  core,
];

const patterns = {
  models: 'models/**/*.{cjs,mts}',
  config: 'config/*.mts',
  routes: 'routes/**/*.{cjs,mts}',
};

export function getModuleFiles(kind: keyof typeof patterns): string[] {
  const orderedModules = kind === 'routes' ? routeModules : modules;
  return orderedModules.flatMap(module =>
    module[kind]
      ? globSync(patterns[kind], { cwd: module.directory })
          .sort()
          .map(file => resolve(module.directory, file))
      : [],
  );
}

export async function loadModuleModels() {
  for (const file of getModuleFiles('models')) {
    await import(pathToFileURL(file).href);
  }
}

export async function initModulesConfiguration(app: Express, db?: Connection) {
  for (const file of getModuleFiles('config')) {
    const { default: configure } = await import(pathToFileURL(file).href);
    await configure(app, db);
  }
}

export async function initModulesServerRoutes(app: Express) {
  for (const file of getModuleFiles('routes')) {
    const { default: register } = await import(pathToFileURL(file).href);
    register(app);
  }
}
