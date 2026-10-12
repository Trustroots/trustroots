const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '../../../..');
const modules = [
  'modules/users/server/config/strategies/local.mjs',
  'modules/users/server/config/users.config.server.mjs',
  'modules/users/server/controllers/users.authentication.server.controller.mjs',
  'modules/users/server/controllers/users.avatar.server.controller.mjs',
  'modules/users/server/controllers/users.block.server.controller.mjs',
  'modules/users/server/controllers/users.export.server.controller.mjs',
  'modules/users/server/controllers/users.lastseen.server.controller.mjs',
  'modules/users/server/controllers/users.password.server.controller.mjs',
  'modules/users/server/controllers/users.profile.server.controller.mjs',
  'modules/users/server/controllers/users.suspended.server.controller.mjs',
  'modules/users/server/jobs/user-finish-signup.server.job.mjs',
  'modules/users/server/jobs/user-welcome-sequence-first.server.job.mjs',
  'modules/users/server/jobs/user-welcome-sequence-second.server.job.mjs',
  'modules/users/server/jobs/user-welcome-sequence-third.server.job.mjs',
  'modules/users/server/models/user.server.model.mjs',
  'modules/users/server/policies/users.server.policy.mjs',
  'modules/users/server/routes/auth.server.routes.mjs',
  'modules/users/server/routes/users-block.server.routes.mjs',
  'modules/users/server/routes/users.server.routes.mjs',
  'modules/users/server/services/authentication.server.service.mjs',
  'modules/users/server/services/historical-spam-cleanup.server.service.mjs',
  'modules/users/server/services/password-hashing.server.service.mjs',
  'modules/core/server/controllers/analytics.server.controller.mjs',
  'modules/core/server/controllers/core.server.controller.mjs',
  'modules/core/server/jobs/send-email.server.job.mjs',
  'modules/core/server/routes/core.server.routes.mjs',
  'modules/core/server/services/email.server.service.mjs',
  'modules/sparkpost/server/controllers/sparkpost-webhooks.server.controller.mjs',
  'modules/sparkpost/server/routes/sparkpost.server.routes.mjs',
];

describe('ESM interoperability: identity-platform', () => {
  it('honours HTTPS and ImageMagick configuration at process startup', function () {
    this.timeout(10000);
    execFileSync(
      process.execPath,
      [
        '-e',
        `
      (async () => {
      const assert = require('node:assert/strict');
      const config = require('./config/config.mjs');
      config.https = true;
      config.domain = 'secure.example.test';
      config.imageProcessor = 'imagemagic';
      await require('./config/lib/mongoose.mjs').loadModels();
      const gm = require('gm');
      const originalSubClass = gm.subClass;
      let processorOptions;
      gm.subClass = options => {
        processorOptions = options;
        return originalSubClass(options);
      };
      require('./modules/users/server/controllers/users.avatar.server.controller.mjs');
      assert.deepEqual(processorOptions, { imageMagick: true });
      const email = require('./modules/core/server/services/email.server.service.mjs');
      let confirmationUrl;
      email.renderEmailAndSend = (template, params) => {
        assert.equal(template, 'reset-password');
        confirmationUrl = params.urlConfirmPlainText;
      };
      email.sendResetPassword({
        displayName: 'Example Member', email: 'member@example.test',
        resetPasswordToken: 'example-token',
      }, () => {});
      assert.equal(confirmationUrl, 'https://secure.example.test/api/auth/reset/example-token');
      process.exit(0);
      })().catch(error => { console.error(error); process.exit(1); });
    `,
      ],
      { cwd: root, stdio: 'pipe' },
    );
  });

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
