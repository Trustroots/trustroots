#!/usr/bin/env node

/**
 * Verify a signed Trustroots member data export.
 *
 *   node bin/verify-data-export.mjs trustroots-data.json
 *
 * Exits 0 when every check passes, 1 otherwise. The point of this tool is that
 * it runs against a downloaded file without a Trustroots server, a database, or
 * a network connection.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as verification from '../modules/users/server/services/data-export-verification.server.service.mjs';

const KEY_HISTORY_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'config',
  'data-export-signing-keys.json',
);

function readKeyHistory() {
  try {
    return JSON.parse(fs.readFileSync(KEY_HISTORY_PATH, 'utf8')).keys || [];
  } catch (error) {
    console.error(`Could not read the pinned key history: ${error.message}`);
    return [];
  }
}

function main(argv) {
  const file = argv[2];

  if (!file) {
    console.error(
      'Usage: node bin/verify-data-export.mjs <trustroots-data.json>',
    );
    return 2;
  }

  let contents;

  try {
    contents = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Could not read ${file}: ${error.message}`);
    return 1;
  }

  const report = verification.verifyExport(contents, {
    keyHistory: readKeyHistory(),
  });

  console.log(verification.describeReport(report));

  return report.valid ? 0 : 1;
}

process.exitCode = main(process.argv);
