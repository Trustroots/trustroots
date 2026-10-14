#!/usr/bin/env node

/**
 * Originally modified from:
 * @link https://github.com/Automattic/wp-calypso/blob/093793d751a7a99a92b05302ea0326669e07a8f1/bin/install-if-no-packages.js
 * @link https://github.com/Automattic/wp-calypso/blob/093793d751a7a99a92b05302ea0326669e07a8f1/bin/install-if-deps-outdated.js
 *
 * Licensed under GNU General Public License v2.0
 * https://github.com/Automattic/wp-calypso/blob/093793d751a7a99a92b05302ea0326669e07a8f1/LICENSE.md
 */
import fs from 'fs';
if (!fs.existsSync('node_modules')) {
  console.error('\n\n\n\nDependencies missing!');
  console.error(
    '\n\nPlease install dependencies by running "pnpm install" first.\n\n',
  );
  process.exit(1);
} else {
  /**
   * Checks if dependencies are up-to-date.
   *
   * For that, modification times of the lockfile and the
   * installed modules marker will be compared. If the lockfile is newer, it means that
   * the packages at node_modules may be outdated. That will happen,
   * for example, when switching branches.
   */
  const needsInstall = () => {
    try {
      const lockfileTime = fs.statSync('pnpm-lock.yaml').mtime.getTime();
      const nodeModulesTime = fs
        .statSync('node_modules/.modules.yaml')
        .mtime.getTime();
      return lockfileTime - nodeModulesTime > 1000; // In Windows, directory mtime has less precision than file mtime
    } catch {
      return true;
    }
  };
  if (needsInstall()) {
    console.warn('\n\n\n\nDependencies out of date.');
    console.warn(
      '\n\nPlease install fresh dependencies by running "pnpm install" first.\n\n',
    );
  } else {
    console.log('Dependencies up to date.');
  }
}
