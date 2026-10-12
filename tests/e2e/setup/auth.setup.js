const fs = require('fs');
const path = require('path');
const { test: setup } = require('../support/fixtures');

setup.describe.configure({ mode: 'serial' });
const {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  authenticateViaApi,
} = require('../support/helpers');

const authDir = path.join(__dirname, '../.auth');
const seededMemberStoragePath = path.join(authDir, 'seeded-member.json');
const adminStoragePath = path.join(authDir, 'admin.json');

setup('create seeded member storage state', async ({ request }) => {
  const user = SEEDED_MEMBERS[0];
  await authenticateViaApi(request, user);

  fs.mkdirSync(authDir, { recursive: true });
  await request.storageState({ path: seededMemberStoragePath });
});

setup('create admin storage state', async ({ request }) => {
  await authenticateViaApi(request, SEEDED_ADMIN);

  fs.mkdirSync(authDir, { recursive: true });
  await request.storageState({ path: adminStoragePath });
});
