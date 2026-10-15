const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const path: typeof import('node:path') = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '../../../..');
const modules = [
  'modules/admin/server/controllers/admin.acquisition-stories.server.controller.mts',
  'modules/admin/server/controllers/admin.audit-log.server.controller.mts',
  'modules/admin/server/controllers/admin.dashboard.server.controller.mts',
  'modules/admin/server/controllers/admin.messages.server.controller.mts',
  'modules/admin/server/controllers/admin.location-corrections.server.controller.mts',
  'modules/admin/server/controllers/admin.newsletter.server.controller.mts',
  'modules/admin/server/controllers/admin.notes.server.controller.mts',
  'modules/admin/server/controllers/admin.reference-threads.server.controller.mts',
  'modules/admin/server/controllers/admin.threads.server.controller.mts',
  'modules/admin/server/controllers/admin.users.server.controller.mts',
  'modules/admin/server/controllers/admin.support.server.controller.mts',
  'modules/admin/server/models/admin-note.server.model.mts',
  'modules/admin/server/models/audit-log.server.model.mts',
  'modules/admin/server/policies/admin.server.policy.mts',
  'modules/admin/server/routes/admin.server.routes.mts',
  'modules/statistics/server/controllers/statistics.server.controller.mjs',
  'modules/statistics/server/jobs/daily-statistics.server.job.mjs',
  'modules/statistics/server/routes/statistics.server.routes.mts',
  'modules/support/server/controllers/support.server.controller.mjs',
  'modules/support/server/models/support.server.model.mjs',
  'modules/support/server/routes/support.server.routes.mts',
  'modules/pages/server/controllers/pages.volunteers.server.controller.mts',
  'modules/pages/server/routes/pages.server.routes.mts',
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
