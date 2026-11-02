#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { MongoClient, type Db } from 'mongodb';
import config from '../../config/config.mts';
import { hashIpAddress } from '../../modules/core/server/services/ip-hash.server.service.mts';

/** Run after stopping old application workers; never print addresses or hashes. */
export async function pseudonymiseIpAddresses(
  db: Db,
  { apply = false, secret = config.ipHashSecret } = {},
) {
  if (!hashIpAddress('127.0.0.1', secret))
    throw new Error(
      'Configure the dedicated IP hashing secret before migration.',
    );
  const users = db.collection('users');
  const counts = {
    users: 0,
    converted: 0,
    changedConcurrently: 0,
    auditLogs: 0,
  };
  for await (const user of users.find(
    { lastIpAddress: { $exists: true } },
    { projection: { lastIpAddress: 1, lastIpHash: 1 } },
  )) {
    counts.users++;
    const hash = hashIpAddress(
      typeof user.lastIpAddress === 'string' ? user.lastIpAddress : undefined,
      secret,
    );
    if (apply) {
      // Preserve identifiers refreshed by the new application after this read.
      const result = await users.updateOne(
        {
          _id: user._id,
          lastIpAddress: { $eq: user.lastIpAddress, $exists: true },
          lastIpHash: Object.hasOwn(user, 'lastIpHash')
            ? user.lastIpHash
            : { $exists: false },
        },
        {
          $unset: { lastIpAddress: '' },
          ...(hash && !user.lastIpHash ? { $set: { lastIpHash: hash } } : {}),
        },
      );
      if (result.matchedCount) counts.converted++;
      else counts.changedConcurrently++;
    }
  }
  const audits = db.collection('auditlogs');
  const fields = ['ip', 'body.ipAddress', 'query.ip', 'query.ipAddress'];
  const query = { $or: fields.map(field => ({ [field]: { $exists: true } })) };
  counts.auditLogs = await audits.countDocuments(query);
  if (apply)
    await audits.updateMany(query, {
      $unset: Object.fromEntries(fields.map(field => [field, ''])),
    });
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
    console.log(
      JSON.stringify({
        dryRun: !process.argv.includes('--apply'),
        ...(await pseudonymiseIpAddresses(client.db(), {
          apply: process.argv.includes('--apply'),
        })),
      }),
    );
  } catch {
    console.error(
      'IP data migration failed. Check configuration, database access and arguments.',
    );
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}
