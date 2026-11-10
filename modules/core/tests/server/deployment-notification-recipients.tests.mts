import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { afterEach, test } from 'vitest';
import { findDeploymentNotificationAddresses } from '../../../../config/lib/deployment-notification-recipients.mts';
import { clearDatabase } from '../../../../testutils/server/data.server.testutil.mts';

afterEach(clearDatabase);

test('deployment recipients are active greeters and admins with unique valid addresses', async () => {
  const db = mongoose.connection.db!;
  const users = db.collection('users');
  await users.insertMany(
    [
      { email: ' Greeter@example.org ', public: true, roles: ['welcome-team'] },
      { email: 'greeter@example.org', public: true, roles: ['admin'] },
      {
        email: 'both@example.org',
        public: true,
        roles: ['admin', 'welcome-team'],
      },
      { email: 'admin@example.org', public: true, roles: ['admin'] },
      { email: 'member@example.org', public: true, roles: ['user'] },
      {
        email: 'suspended@example.org',
        public: true,
        roles: ['admin', 'suspended'],
      },
      { email: 'unconfirmed@example.org', public: false, roles: ['admin'] },
      { email: 'legacy@example.org', roles: ['welcome-team'] },
      { email: 'invalid', public: true, roles: ['admin'] },
      { email: 42, public: true, roles: ['admin'] },
      {
        email: 'first@example.org,second@example.org',
        public: true,
        roles: ['admin'],
      },
    ].map((user, index) => ({ ...user, username: `recipient-${index}` })),
  );
  const removed = await users.insertOne({
    email: 'removed@example.org',
    username: 'removed-recipient',
    public: true,
    roles: ['welcome-team'],
  });
  await users.deleteOne({ _id: removed.insertedId });

  assert.deepEqual(
    await findDeploymentNotificationAddresses(db),
    new Set(['greeter@example.org', 'both@example.org', 'admin@example.org']),
  );
});
