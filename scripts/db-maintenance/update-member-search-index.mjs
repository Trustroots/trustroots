/**
 * Preview: NODE_ENV=production node scripts/db-maintenance/update-member-search-index.mjs
 * Apply in a maintenance window: add --apply.
 * MongoDB permits one text index per collection: search is briefly unavailable
 * while that index is rebuilt. Other indexes and profile documents are untouched.
 */
import mongoose from 'mongoose';
import config from '../../config/config.mjs';
import '../../modules/users/server/models/user.server.model.mjs';

const User = mongoose.model('User');
const [keys, options] = User.schema
  .indexes()
  .find(([definition]) => definition.username === 'text');
if (!process.argv.includes('--apply')) {
  console.log('Member-search text index plan:', { keys, options });
  console.log(
    'Run with --apply in a maintenance window to replace only the users text index.',
  );
} else {
  try {
    await mongoose.connect(config.db.uri, {
      autoIndex: false,
      autoCreate: false,
    });
    const indexes = await User.collection.indexes();
    const existing = indexes.find(index => index.key._fts === 'text');
    const unchanged =
      existing &&
      JSON.stringify(Object.entries(existing.weights).sort()) ===
        JSON.stringify(Object.entries(options.weights).sort());
    if (unchanged) {
      console.log('Member-search index is already current.');
    } else {
      if (existing) await User.collection.dropIndex(existing.name);
      await User.collection.createIndex(keys, options);
      console.log('Member-search text index updated.');
    }
  } finally {
    await mongoose.disconnect();
  }
}
