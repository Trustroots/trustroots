#!/usr/bin/env node

/**
 * Create only the indexes required by circle member discovery.
 *
 * Usage: pnpm run ensure-circle-discovery-indexes
 *
 * This is safe to run more than once. It never drops or synchronises indexes.
 */
import mongooseService from './../../config/lib/mongoose.mts';
import { circleDiscoveryIndexes } from '../../config/lib/circle-discovery-indexes.mts';
import type { Connection } from 'mongoose';

mongooseService.connect(async (connection: Connection) => {
  try {
    const db = connection.db!;
    await Promise.all(
      circleDiscoveryIndexes.map(({ collection, key, name }) =>
        db.collection(collection).createIndex(key, { name }),
      ),
    );
    console.log('Created circle discovery indexes.');
  } catch (error) {
    console.error('Could not create circle discovery indexes.', error);
    process.exitCode = 1;
  } finally {
    await mongooseService.disconnect();
  }
});
