import fs from 'node:fs';
import path from 'node:path';
import { test as setup } from '../support/fixtures.mts';
import {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  authenticateViaApi,
} from '../support/helpers.mts';

setup.describe.configure({ mode: 'serial' });

const authDir = path.join(import.meta.dirname, '../.auth');
const seededMemberStoragePath = path.join(authDir, 'seeded-member.json');
const adminStoragePath = path.join(authDir, 'admin.json');

setup('create seeded member storage state', async ({ request }) => {
  const user = SEEDED_MEMBERS[0];
  if (!user) {
    throw new Error('Seeded E2E member fixture is missing.');
  }
  await authenticateViaApi(request, user);

  fs.mkdirSync(authDir, { recursive: true });
  await request.storageState({ path: seededMemberStoragePath });
});

setup('create admin storage state', async ({ request }) => {
  await authenticateViaApi(request, SEEDED_ADMIN);

  fs.mkdirSync(authDir, { recursive: true });
  await request.storageState({ path: adminStoragePath });
});
