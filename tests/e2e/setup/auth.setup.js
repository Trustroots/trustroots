const fs = require('fs');
const path = require('path');
const { test: setup } = require('../support/test');

setup.describe.configure({ mode: 'serial' });
const {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  signInViaApi,
} = require('../support/helpers');

const authDir = path.join(__dirname, '../.auth');
const seededMemberStoragePath = path.join(authDir, 'seeded-member.json');
const adminStoragePath = path.join(authDir, 'admin.json');

setup('create seeded member storage state', async ({ page, request }) => {
  const user = SEEDED_MEMBERS[0];
  await signInViaApi(page, request, user);

  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: seededMemberStoragePath });
});

setup('create admin storage state', async ({ page, request }) => {
  await signInViaApi(page, request, SEEDED_ADMIN);

  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: adminStoragePath });
});
