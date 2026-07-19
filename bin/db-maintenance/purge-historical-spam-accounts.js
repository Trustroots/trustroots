#!/usr/bin/env node

/**
 * Remove inactive accounts from the two investigated historical spam campaigns.
 *
 * Usage:
 *   node bin/db-maintenance/purge-historical-spam-accounts.js
 *   node bin/db-maintenance/purge-historical-spam-accounts.js --delete
 */
const mongooseService = require('../../config/lib/mongoose');

const arguments_ = process.argv.slice(2);
const deleteAccounts = arguments_.includes('--delete');
const unknownArguments = arguments_.filter(argument => argument !== '--delete');

if (unknownArguments.length) {
  console.error(`Unknown argument(s): ${unknownArguments.join(', ')}`);
  process.exit(1);
}

mongooseService.connect(async () => {
  const cleanup = require('../../modules/users/server/services/historical-spam-cleanup.server.service');

  try {
    console.log(
      deleteAccounts
        ? 'Deleting eligible historical spam accounts...'
        : 'Dry run: no accounts will be deleted.',
    );

    const result = await cleanup.run({
      deleteAccounts,
      onBatch: batch => {
        console.log(
          `Processed ${batch.candidates}; eligible ${batch.eligible}; protected ${batch.protected}; deleted ${batch.deleted}.`,
        );
      },
    });

    console.log(
      `Complete: ${result.candidates} candidates; ${result.eligible} eligible; ${result.protected} protected; ${result.deleted} deleted.`,
    );
  } catch (err) {
    console.error('Historical spam cleanup failed:', err);
    process.exitCode = 1;
  } finally {
    await mongooseService.disconnect();
  }
});
