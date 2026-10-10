#!/usr/bin/env node
/* eslint-disable no-console */
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import config from '../../config/config.mjs';
import mongooseService from '../../config/lib/mongoose.mjs';

// Usage: NODE_ENV=production node bin/db-maintenance/link-support-reports.mjs mappings.json ADMIN_ID [--apply]
// The mappings are manually verified evidence, not matches against current usernames.
const [filename, actorId, mode] = process.argv.slice(2);
try {
  if (!filename || !actorId || (mode && mode !== '--apply'))
    throw new Error(
      'Usage: link-support-reports.mjs mappings.json ADMIN_ID [--apply]',
    );
  const mappings = JSON.parse(await readFile(filename, 'utf8'));
  if (!Array.isArray(mappings))
    throw new Error('Mappings must be a JSON array.');
  await mongoose.connect(config.db.uri, {
    autoIndex: false,
    autoCreate: false,
  });
  await mongooseService.loadModels();
  const { linkHistoricalReport } = await import(
    '../../modules/support/server/services/report-link.server.service.mjs'
  );
  for (const mapping of mappings)
    console.log(
      await linkHistoricalReport(mapping, actorId, mode === '--apply'),
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await new Promise(resolve => mongooseService.disconnect(resolve));
}
