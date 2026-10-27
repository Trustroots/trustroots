#!/usr/bin/env node
import mongoose from 'mongoose';
import config from '../../config/config.mts';
import mongooseService from '../../config/lib/mongoose.mjs';

try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--apply')) {
    throw new Error('Usage: migrate-support-inbox.mts [--apply]');
  }
  await mongoose.connect(config.db.uri, {
    autoIndex: false,
    autoCreate: false,
  });
  await mongooseService.loadModels();
  const { migrateSupportInbox } =
    await import('../../modules/support/server/services/support-migration.server.service.mts');
  console.log(await migrateSupportInbox(args[0] === '--apply'));
} catch {
  console.error(
    'Support inbox migration failed. Check arguments and database access.',
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
