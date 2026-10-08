#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { MongoClient } from 'mongodb';
import config from '../../config/config.mjs';
import { hashToken } from '../../modules/users/server/services/action-token.server.service.mjs';

const fields = ['emailToken', 'resetPasswordToken', 'removeProfileToken'];
export async function hashLegacyTokens(collection, { apply = false } = {}) {
  const counts = { candidates: 0, converted: 0, changedConcurrently: 0 };
  const query = {
    $or: fields.map(field => ({
      [field]: { $type: 'string', $ne: '', $not: /^sha256:/ },
    })),
  };
  for await (const user of collection.find(query, {
    projection: { emailToken: 1, resetPasswordToken: 1, removeProfileToken: 1 },
  })) {
    for (const field of fields) {
      const token = user[field];
      if (typeof token !== 'string' || !token || token.startsWith('sha256:'))
        continue;
      counts.candidates++;
      if (apply) {
        // Never resurrect a token consumed or replaced since this read.
        const result = await collection.updateOne(
          { _id: user._id, [field]: token },
          { $set: { [field]: hashToken(token) } },
        );
        if (result.matchedCount === 1) counts.converted++;
        else counts.changedConcurrently++;
      }
    }
  }
  return counts;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const client = new MongoClient(config.db.uri);
  try {
    if (process.argv.slice(2).some(argument => argument !== '--apply'))
      throw new Error('Use --apply or no arguments for a dry run.');
    await client.connect();
    const counts = await hashLegacyTokens(client.db().collection('users'), {
      apply: process.argv.includes('--apply'),
    });
    console.log(
      JSON.stringify({ dryRun: !process.argv.includes('--apply'), ...counts }),
    );
  } catch {
    console.error(
      'Account token migration failed. Check database access and arguments.',
    );
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}
