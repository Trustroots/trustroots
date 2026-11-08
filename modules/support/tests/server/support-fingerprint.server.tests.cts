const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { createHash }: typeof import('node:crypto') = require('node:crypto');
const {
  normaliseStoredSupportCategory,
  normaliseSupportImportMessage,
  supportImportMessageHash,
  supportImportSenderHash,
  supportRequestFingerprint,
  supportRequestImportFingerprints,
}: typeof import('../../server/services/support-fingerprint.server.service.mts') = require('../../server/services/support-fingerprint.server.service.mts');

const sha256 = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');
const fingerprintOf = (message: string) =>
  sha256(JSON.stringify(['other', 'a@b.org', message]));

describe('Support fingerprints', () => {
  describe('stored category normalisation', () => {
    it('defaults a missing category to other unless a member is named', () => {
      for (const category of [undefined, null, '']) {
        assert.equal(normaliseStoredSupportCategory(category), 'other');
        assert.equal(normaliseStoredSupportCategory(category, '  '), 'other');
        assert.equal(normaliseStoredSupportCategory(category, 5), 'other');
        assert.equal(
          normaliseStoredSupportCategory(category, ' someone '),
          'reportMember',
        );
      }
    });

    it('keeps known categories and rejects unknown ones', () => {
      assert.equal(normaliseStoredSupportCategory('reportBug'), 'reportBug');
      for (const category of [
        'unknown',
        'toString',
        5,
        { toString: () => 'other' },
      ]) {
        assert.equal(normaliseStoredSupportCategory(category), null);
      }
    });
  });

  it('fingerprints a request by category, normalised email and message, keeping non-ASCII text', () => {
    assert.equal(
      supportRequestFingerprint({
        category: 'other',
        email: ' A@B.ORG\n',
        message: '\n Hi\r\nthere \n',
      }),
      fingerprintOf('Hi\nthere'),
    );
    assert.equal(
      supportRequestFingerprint({
        category: 'other',
        email: 'a@b.org',
        message: 'héllo ✓',
      }),
      fingerprintOf('héllo ✓'),
    );
  });

  it('normalises imported messages', () => {
    const max = String.fromCodePoint(0x10ffff);
    for (const [name, input, expected] of [
      ['escaped HTML', '&amp; &LT; &gt; &quot; &#39; &apos;', "& < > \" ' '"],
      ['numeric entities', '&#65;&#x42;&#X43;', 'ABC'],
      ['the lowest code point', '&#0;', '\u0000'],
      ['the highest decimal code point', '&#1114111;', max],
      ['the highest hex code point', '&#x10ffff;', max],
      ['an out-of-range decimal', '&#1114112;', '&#1114112;'],
      ['an out-of-range hex', '&#x110000;', '&#x110000;'],
      ['a huge entity', `&#${'9'.repeat(400)};`, `&#${'9'.repeat(400)};`],
      ['surrounding blank lines', '\n\n hello \n\n', 'hello'],
      [
        'line endings, spacing and blank lines',
        '  one \t two \r\nthree\rfour\n\n\n\nfive  ',
        'one two\nthree\nfour\n\nfive',
      ],
      [
        'a bare web address',
        'see www.example.org now',
        'see http://www.example.org now',
      ],
      [
        'emails, phone numbers, mentions and hashtags',
        'a@example.org +1 415 555 2671 @someone #topic',
        'a@example.org +1 415 555 2671 @someone #topic',
      ],
      [
        'an explicit address',
        'https://www.example.org/a',
        'https://www.example.org/a',
      ],
    ]) {
      assert.equal(normaliseSupportImportMessage(input!), expected, name);
    }
  });

  it('hashes the import sender by trimmed lowercase email and the normalised message', () => {
    assert.equal(supportImportSenderHash(' A@B.ORG '), sha256('a@b.org'));
    assert.equal(
      supportImportMessageHash('Hi &amp;\r\nyou  '),
      sha256('Hi &\nyou'),
    );
    assert.equal(supportImportMessageHash('héllo ✓'), sha256('héllo ✓'));
  });

  describe('import fingerprint alternatives', () => {
    const input = {
      category: 'other' as const,
      email: 'a&b@example.org',
      message: `Tom & "Jerry" <it's> www.example.org a@example.org +1 415 555 2671`,
    };

    it('lists the original first, then the escaped and link-expanded renderings', () => {
      const escaped = {
        ...input,
        email: 'a&amp;b@example.org',
        message: `Tom &amp; &quot;Jerry&quot; &lt;it&#39;s&gt; www.example.org a@example.org +1 415 555 2671`,
      };
      const expanded = {
        ...input,
        message: `Tom & "Jerry" <it's> http://www.example.org a@example.org +1 415 555 2671`,
      };
      assert.deepEqual(supportRequestImportFingerprints(input), [
        supportRequestFingerprint(input),
        supportRequestFingerprint(escaped),
        supportRequestFingerprint(expanded),
      ]);
    });

    it('deduplicates identical renderings', () => {
      const plain = { category: 'other' as const, email: 'a@example.org' };
      assert.equal(
        supportRequestImportFingerprints({ ...plain, message: 'plain text' })
          .length,
        1,
      );
    });
  });
});
