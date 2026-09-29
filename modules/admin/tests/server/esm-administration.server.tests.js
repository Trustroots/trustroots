const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '../../../..');
const modules = [
  'modules/admin/server/controllers/admin.acquisition-stories.server.controller.js',
  'modules/admin/server/controllers/admin.audit-log.server.controller.js',
  'modules/admin/server/controllers/admin.dashboard.server.controller.js',
  'modules/admin/server/controllers/admin.messages.server.controller.js',
  'modules/admin/server/controllers/admin.newsletter.server.controller.js',
  'modules/admin/server/controllers/admin.notes.server.controller.js',
  'modules/admin/server/controllers/admin.reference-threads.server.controller.js',
  'modules/admin/server/controllers/admin.threads.server.controller.js',
  'modules/admin/server/controllers/admin.users.server.controller.js',
  'modules/admin/server/models/admin-note.server.model.js',
  'modules/admin/server/models/audit-log.server.model.js',
  'modules/admin/server/policies/admin.server.policy.js',
  'modules/admin/server/routes/admin.server.routes.js',
  'modules/statistics/server/controllers/statistics.server.controller.js',
  'modules/statistics/server/jobs/daily-statistics.server.job.js',
  'modules/statistics/server/routes/statistics.server.routes.js',
  'modules/support/server/controllers/support.server.controller.js',
  'modules/support/server/models/support.server.model.js',
  'modules/support/server/routes/support.server.routes.js',
  'modules/pages/server/controllers/pages.volunteers.server.controller.js',
  'modules/pages/server/routes/admin.server.routes.js',
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
