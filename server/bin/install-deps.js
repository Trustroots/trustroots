#!/usr/bin/env node

/**
 * Originally modified from:
 * @link https://github.com/Automattic/wp-calypso/blob/093793d751a7a99a92b05302ea0326669e07a8f1/bin/install-if-no-packages.js
 * @link https://github.com/Automattic/wp-calypso/blob/093793d751a7a99a92b05302ea0326669e07a8f1/bin/install-if-deps-outdated.js
 *
 * Licensed under GNU General Public License v2.0
 * https://github.com/Automattic/wp-calypso/blob/093793d751a7a99a92b05302ea0326669e07a8f1/LICENSE.md
 */

const fs = require('fs');
const spawnSync = require('child_process').spawnSync;

if (!fs.existsSync('node_modules')) {
  console.log('No "node_modules" present, installing NPM dependencies...');
  const installResult = spawnSync('npm', [ 'ci' ], {
    shell: true,
    stdio: 'inherit'
  }).status;
  if (installResult) {
    process.exit(installResult);
  }
} else {
  /**
   * Installs NPM dependencies. Since that's a costly operation,
   * it will only perform it if needed, that is, if the packages
   * installed at `node_modules` aren't in sync over what
   * `package-lock.json` has. For that, modification times of both
   * files will be compared. If the package-lock is newer, it means that
   * the packages at node_modules may be outdated. That will happen,
   * for example, when switching branches.
   */
  const needsInstall = () => {
    try {
      const packageLockTime = fs.statSync('package-lock.json').mtime;
      const nodeModulesTime = fs.statSync('node_modules').mtime;
      return packageLockTime - nodeModulesTime > 1000; // In Windows, directory mtime has less precision than file mtime
    } catch (e) {
      return true;
    }
  };

  if (needsInstall()) {
    console.log('NPM dependencies out of date. Updating...');
    const installResult = spawnSync('npm', [ 'ci' ], {
      shell: true,
      stdio: 'inherit'
    }).status;
    if (installResult) {
      process.exit(installResult);
    }
    fs.utimesSync('node_modules', new Date(), new Date());
  } else {
    console.log('NPM dependencies up to date.');
  }
}
