const assert = require('assert');

const buildMetadata = require('../../../../config/lib/build-metadata');

describe('Build metadata helper', () => {
  it('formats dates in UTC', () => {
    const date = new Date('2026-06-21T19:06:12+01:00');

    assert.strictEqual(
      buildMetadata.formatUtcDateTime(date),
      '2026-06-21 18:06',
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

  it('returns false for incomplete metadata', () => {
    assert.strictEqual(buildMetadata.buildMetadataFromGitLog(''), false);
    assert.strictEqual(
      buildMetadata.buildMetadataFromGitLog('7a1d639\nnot-a-date'),
      false,
    );
  });
});
