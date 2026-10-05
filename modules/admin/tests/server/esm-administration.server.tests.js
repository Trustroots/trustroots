const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '../../../..');
const modules = [
  'modules/admin/server/controllers/admin.acquisition-stories.server.controller.mjs',
  'modules/admin/server/controllers/admin.audit-log.server.controller.mjs',
  'modules/admin/server/controllers/admin.dashboard.server.controller.mjs',
  'modules/admin/server/controllers/admin.messages.server.controller.mjs',
  'modules/admin/server/controllers/admin.newsletter.server.controller.mjs',
  'modules/admin/server/controllers/admin.notes.server.controller.mjs',
  'modules/admin/server/controllers/admin.reference-threads.server.controller.mjs',
  'modules/admin/server/controllers/admin.threads.server.controller.mjs',
  'modules/admin/server/controllers/admin.users.server.controller.mjs',
  'modules/admin/server/models/admin-note.server.model.mjs',
  'modules/admin/server/models/audit-log.server.model.mjs',
  'modules/admin/server/policies/admin.server.policy.mjs',
  'modules/admin/server/routes/admin.server.routes.mjs',
  'modules/statistics/server/controllers/statistics.server.controller.mjs',
  'modules/statistics/server/jobs/daily-statistics.server.job.mjs',
  'modules/statistics/server/routes/statistics.server.routes.mjs',
  'modules/support/server/controllers/support.server.controller.mjs',
  'modules/support/server/models/support.server.model.mjs',
  'modules/support/server/routes/support.server.routes.mjs',
  'modules/pages/server/controllers/pages.volunteers.server.controller.mjs',
  'modules/pages/server/routes/admin.server.routes.mjs',
];

describe('ESM interoperability: administration', () => {
  for (const relativePath of modules) {
    it(`preserves the CommonJS API for ${relativePath}`, async () => {
      const legacyPath = path.join(root, relativePath);
      const legacy = require(legacyPath);
      const implementation = await import(
        pathToFileURL(legacyPath.replace(/\.js$/, '.mjs')).href
      );
      assert.strictEqual(implementation.default, legacy);
      for (const [name, value] of Object.entries(legacy)) {
        if (typeof value === 'function') {
          assert.strictEqual(implementation[name], value, name);
        }
      }
    });
  }
});
