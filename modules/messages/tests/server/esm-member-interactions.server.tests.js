const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '../../../..');
const modules = [
  'modules/messages/server/controllers/messages.server.controller.js',
  'modules/messages/server/jobs/message-unread.server.job.js',
  'modules/messages/server/models/message-stat.server.model.js',
  'modules/messages/server/models/message.server.model.js',
  'modules/messages/server/models/thread.server.model.js',
  'modules/messages/server/policies/messages.server.policy.js',
  'modules/messages/server/routes/messages.server.routes.js',
  'modules/messages/server/services/message-stat.server.service.js',
  'modules/messages/server/services/message-to-stats.server.service.js',
  'modules/contacts/server/controllers/contacts.server.controller.js',
  'modules/contacts/server/models/contacts.server.model.js',
  'modules/contacts/server/policies/contacts.server.policy.js',
  'modules/contacts/server/routes/contacts.server.routes.js',
  'modules/experiences/server/controllers/experiences.server.controller.js',
  'modules/experiences/server/jobs/experiences-publish.server.job.js',
  'modules/experiences/server/models/experiences.server.model.js',
  'modules/experiences/server/policies/experiences.server.policy.js',
  'modules/experiences/server/routes/experiences.server.routes.js',
  'modules/offers/server/controllers/offers.server.controller.js',
  'modules/offers/server/jobs/reactivate-hosts.server.job.js',
  'modules/offers/server/models/offer.server.model.js',
  'modules/offers/server/policies/offers.server.policy.js',
  'modules/offers/server/routes/offers.server.routes.js',
  'modules/references-thread/server/controllers/reference-thread.server.controller.js',
  'modules/references-thread/server/models/reference-thread.server.model.js',
  'modules/references-thread/server/policies/reference-thread.server.policy.js',
  'modules/references-thread/server/routes/reference-thread.server.routes.js',
  'modules/tribes/server/controllers/tribes.server.controller.js',
  'modules/tribes/server/models/tribe.server.model.js',
  'modules/tribes/server/policies/tribes.server.policy.js',
  'modules/tribes/server/routes/tribes.server.routes.js',
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
