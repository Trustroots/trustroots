#!/usr/bin/env node

/**
 * Create only the indexes required by circle member discovery.
 *
 * Usage: npm run ensure-circle-discovery-indexes
 *
 * This is safe to run more than once. It never drops or synchronises indexes.
 */
import mongooseService from './../../config/lib/mongoose.mjs';

mongooseService.connect(async connection => {
  try {
    await Promise.all([
      connection.db
        .collection('users')
        .createIndex(
          { 'member.tribe': 1, seen: -1, _id: 1 },
          { name: 'circle_discovery_member_seen' },
        ),
      connection.db
        .collection('experiences')
        .createIndex(
          { userTo: 1, public: 1, recommend: 1, created: -1 },
          { name: 'circle_discovery_recommenders' },
        ),
    ]);
    console.log('Created circle discovery indexes.');
  } catch (error) {
    console.error('Could not create circle discovery indexes.', error);
    process.exitCode = 1;
  } finally {
    await mongooseService.disconnect();
  }
});
