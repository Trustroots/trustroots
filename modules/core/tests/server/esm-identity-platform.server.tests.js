const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '../../../..');
const modules = [
  'modules/users/server/config/strategies/local.js',
  'modules/users/server/config/users.config.server.js',
  'modules/users/server/controllers/users.authentication.server.controller.js',
  'modules/users/server/controllers/users.avatar.server.controller.js',
  'modules/users/server/controllers/users.block.server.controller.js',
  'modules/users/server/controllers/users.export.server.controller.js',
  'modules/users/server/controllers/users.lastseen.server.controller.js',
  'modules/users/server/controllers/users.password.server.controller.js',
  'modules/users/server/controllers/users.profile.server.controller.js',
  'modules/users/server/controllers/users.suspended.server.controller.js',
  'modules/users/server/jobs/user-finish-signup.server.job.js',
  'modules/users/server/jobs/user-welcome-sequence-first.server.job.js',
  'modules/users/server/jobs/user-welcome-sequence-second.server.job.js',
  'modules/users/server/jobs/user-welcome-sequence-third.server.job.js',
  'modules/users/server/models/user.server.model.js',
  'modules/users/server/policies/users.server.policy.js',
  'modules/users/server/routes/auth.server.routes.js',
  'modules/users/server/routes/users-block.server.routes.js',
  'modules/users/server/routes/users.server.routes.js',
  'modules/users/server/services/authentication.server.service.js',
  'modules/users/server/services/historical-spam-cleanup.server.service.js',
  'modules/core/server/controllers/analytics.server.controller.js',
  'modules/core/server/controllers/core.server.controller.js',
  'modules/core/server/jobs/send-email.server.job.js',
  'modules/core/server/routes/core.server.routes.js',
  'modules/core/server/services/email.server.service.js',
  'modules/sparkpost/server/controllers/sparkpost-webhooks.server.controller.js',
  'modules/sparkpost/server/routes/sparkpost.server.routes.js',
];

describe('ESM interoperability: identity-platform', () => {
  it('honours HTTPS and ImageMagick configuration at process startup', function () {
    this.timeout(10000);
    execFileSync(
      process.execPath,
      [
        '-e',
        `
      const assert = require('node:assert/strict');
      const config = require('./config/config');
      config.https = true;
      config.domain = 'secure.example.test';
      config.imageProcessor = 'imagemagic';
      require('./config/lib/mongoose').loadModels();
      const gm = require('gm');
      const originalSubClass = gm.subClass;
      let processorOptions;
      gm.subClass = options => {
        processorOptions = options;
        return originalSubClass(options);
      };
      require('./modules/users/server/controllers/users.avatar.server.controller');
      assert.deepEqual(processorOptions, { imageMagick: true });
      const email = require('./modules/core/server/services/email.server.service');
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
