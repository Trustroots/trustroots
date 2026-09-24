const assert = require('assert');
const { execFileSync } = require('child_process');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');

const buildMetadata = require('../../../../config/lib/build-metadata');
const typedMetadata = require('../../../../config/lib/build-metadata.cts');

describe('Build metadata helper', () => {
  it('loads both typed helpers with Node native type stripping', () => {
    const authenticationPath = require.resolve(
      '../../../../modules/users/server/services/authentication.server.service.cts',
    );
    const metadataPath = require.resolve(
      '../../../../config/lib/build-metadata.cts',
    );
    const output = execFileSync(
      process.execPath,
      [
        '-e',
        `const auth = require(process.argv[1]);
const metadata = require(process.argv[2]);
process.stdout.write(JSON.stringify({
  username: auth.validateUsername('traveller', () => false),
  date: metadata.formatUtcDateTime(new Date('2026-06-21T18:06:12Z')),
}));`,
        authenticationPath,
        metadataPath,
      ],
      {
        env: {
          OPENSSL_CONF: process.env.OPENSSL_CONF,
          PATH: process.env.PATH,
        },
      },
    ).toString();

    assert.deepStrictEqual(JSON.parse(output), {
      username: true,
      date: '2026-06-21 18:06',
    });
  });

  const buildEnvironmentVariables = [
    'TRUSTROOTS_BUILD_BRANCH',
    'TRUSTROOTS_BUILD_COMMIT',
    'TRUSTROOTS_BUILD_COMMITTED_AT',
  ];
  const originalBuildEnvironment = {};

  beforeEach(() => {
    buildEnvironmentVariables.forEach(variable => {
      originalBuildEnvironment[variable] = process.env[variable];
      delete process.env[variable];
    });
  });

  afterEach(() => {
    buildEnvironmentVariables.forEach(variable => {
      if (originalBuildEnvironment[variable] === undefined) {
        delete process.env[variable];
      } else {
        process.env[variable] = originalBuildEnvironment[variable];
      }
    });
  });

  it('formats dates in UTC', () => {
    const date = new Date('2026-06-21T19:06:12+01:00');

    assert.strictEqual(
      buildMetadata.formatUtcDateTime(date),
      '2026-06-21 18:06',
    );
    assert.strictEqual(
      typedMetadata.formatUtcDateTime,
      buildMetadata.formatUtcDateTime,
    );
  });

  it('builds metadata from git log output', () => {
    const metadata = buildMetadata.buildMetadataFromGitLog(
      '7a1d63965692fdb3361d3fd9ad1a6a17fb391b92\n2026-06-21T19:06:12+01:00',
    );

    assert.deepStrictEqual(metadata, {
      commit: '7a1d63965692fdb3361d3fd9ad1a6a17fb391b92',
      shortCommit: '7a1d639',
      committedAt: '2026-06-21 18:06',
      commitUrl:
        'https://github.com/Trustroots/trustroots/commit/7a1d63965692fdb3361d3fd9ad1a6a17fb391b92',
    });
  });

  it('builds metadata with branch information', () => {
    const metadata = buildMetadata.buildMetadataFromGitLog(
      '7a1d63965692fdb3361d3fd9ad1a6a17fb391b92\n2026-06-21T19:06:12+01:00\ncodex/footer-polish',
    );

    assert.strictEqual(metadata.branch, 'codex/footer-polish');
  });

  it('normalizes refs branch information', () => {
    const metadata = buildMetadata.buildMetadataFromGitLog(
      '7a1d63965692fdb3361d3fd9ad1a6a17fb391b92\n2026-06-21T19:06:12+01:00',
      'refs/heads/main',
    );

    assert.strictEqual(metadata.branch, 'main');
  });

  it('builds metadata from the production image environment', () => {
    process.env.TRUSTROOTS_BUILD_COMMIT =
      '7a1d63965692fdb3361d3fd9ad1a6a17fb391b92';
    process.env.TRUSTROOTS_BUILD_COMMITTED_AT = '2026-06-21T19:06:12+01:00';
    process.env.TRUSTROOTS_BUILD_BRANCH = 'refs/heads/main';

    assert.deepStrictEqual(buildMetadata.buildMetadataFromEnvironment(), {
      commit: '7a1d63965692fdb3361d3fd9ad1a6a17fb391b92',
      shortCommit: '7a1d639',
      committedAt: '2026-06-21 18:06',
      commitUrl:
        'https://github.com/Trustroots/trustroots/commit/7a1d63965692fdb3361d3fd9ad1a6a17fb391b92',
      branch: 'main',
    });
  });

  it('uses production image metadata without running git', done => {
    process.env.TRUSTROOTS_BUILD_COMMIT =
      '7a1d63965692fdb3361d3fd9ad1a6a17fb391b92';
    process.env.TRUSTROOTS_BUILD_COMMITTED_AT = '2026-06-21T19:06:12+01:00';
    const execFile = sinon.spy();
    const environmentBuildMetadata = proxyquire(
      '../../../../config/lib/build-metadata',
      {
        child_process: { execFile },
      },
    );

    environmentBuildMetadata.getBuildMetadata(metadata => {
      assert.strictEqual(metadata.shortCommit, '7a1d639');
      assert.strictEqual(execFile.called, false);
      done();
    });
  });

  it('returns false for incomplete metadata', () => {
    assert.strictEqual(buildMetadata.buildMetadataFromGitLog(''), false);
    assert.strictEqual(
      buildMetadata.buildMetadataFromGitLog('7a1d639\nnot-a-date'),
      false,
    );
    process.env.TRUSTROOTS_BUILD_COMMIT = '7a1d639';
    assert.strictEqual(buildMetadata.buildMetadataFromEnvironment(), false);
  });
});
