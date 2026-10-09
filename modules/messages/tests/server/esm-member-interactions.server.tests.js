const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '../../../..');
const modules = [
  'modules/messages/server/controllers/messages.server.controller.mjs',
  'modules/messages/server/jobs/message-unread.server.job.mjs',
  'modules/messages/server/models/message-stat.server.model.mjs',
  'modules/messages/server/models/message.server.model.mjs',
  'modules/messages/server/models/thread.server.model.mjs',
  'modules/messages/server/policies/messages.server.policy.mjs',
  'modules/messages/server/routes/messages.server.routes.mjs',
  'modules/messages/server/services/message-stat.server.service.mjs',
  'modules/messages/server/services/message-to-stats.server.service.mjs',
  'modules/contacts/server/controllers/contacts.server.controller.mjs',
  'modules/contacts/server/models/contacts.server.model.mjs',
  'modules/contacts/server/policies/contacts.server.policy.mjs',
  'modules/contacts/server/routes/contacts.server.routes.mjs',
  'modules/experiences/server/controllers/experiences.server.controller.mjs',
  'modules/experiences/server/jobs/experiences-publish.server.job.mjs',
  'modules/experiences/server/models/experiences.server.model.mjs',
  'modules/experiences/server/policies/experiences.server.policy.mjs',
  'modules/experiences/server/routes/experiences.server.routes.mjs',
  'modules/offers/server/controllers/offers.server.controller.mjs',
  'modules/offers/server/jobs/reactivate-hosts.server.job.mjs',
  'modules/offers/server/models/offer.server.model.mjs',
  'modules/offers/server/policies/offers.server.policy.mjs',
  'modules/offers/server/routes/offers.server.routes.mjs',
  'modules/references-thread/server/controllers/reference-thread.server.controller.mjs',
  'modules/references-thread/server/models/reference-thread.server.model.mjs',
  'modules/references-thread/server/policies/reference-thread.server.policy.mjs',
  'modules/references-thread/server/routes/reference-thread.server.routes.mjs',
  'modules/tribes/server/controllers/tribes.server.controller.mjs',
  'modules/tribes/server/models/tribe.server.model.mjs',
  'modules/tribes/server/policies/tribes.server.policy.mjs',
  'modules/tribes/server/routes/tribes.server.routes.mjs',
];

describe('ESM interoperability: member-interactions', () => {
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
