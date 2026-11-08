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

describe('Support fingerprints', () => {
  describe('stored category normalisation', () => {
    it('defaults a missing category to other', () => {
      for (const category of [undefined, null, '']) {
        assert.equal(normaliseStoredSupportCategory(category), 'other');
        assert.equal(normaliseStoredSupportCategory(category, '  '), 'other');
        assert.equal(normaliseStoredSupportCategory(category, 5), 'other');
      }
    });

    it('infers a member report from a reported member name', () => {
      for (const category of [undefined, null, '']) {
        assert.equal(
          normaliseStoredSupportCategory(category, ' someone '),
          'reportMember',
        );
      }
    });

    it('keeps known categories and rejects unknown ones', () => {
      assert.equal(normaliseStoredSupportCategory('reportBug'), 'reportBug');
      assert.equal(normaliseStoredSupportCategory('unknown'), null);
      assert.equal(normaliseStoredSupportCategory('toString'), null);
      assert.equal(normaliseStoredSupportCategory(5), null);
      assert.equal(
        normaliseStoredSupportCategory({ toString: () => 'other' }),
        null,
      );
    });
  });

  describe('request fingerprint', () => {
    it('hashes the category, normalised email and normalised message', () => {
      const expected = sha256(
        JSON.stringify(['other', 'a@b.org', 'Hi\nthere']),
      );
      assert.equal(
        supportRequestFingerprint({
          category: 'other',
          email: ' A@B.ORG\n',
          message: '\n Hi\r\nthere \n',
        }),
        expected,
      );
    });

    it('keeps non-ASCII text intact', () => {
      assert.equal(
        supportRequestFingerprint({
          category: 'other',
          email: 'a@b.org',
          message: 'héllo ✓',
        }),
        sha256(JSON.stringify(['other', 'a@b.org', 'héllo ✓'])),
      );
    });
  });

  describe('import message normalisation', () => {
    it('decodes the escaped HTML characters', () => {
      assert.equal(
        normaliseSupportImportMessage('&amp; &LT; &gt; &quot; &#39; &apos;'),
        "& < > \" ' '",
      );
    });

    it('decodes numeric entities within the Unicode range', () => {
      assert.equal(normaliseSupportImportMessage('&#65;&#x42;&#X43;'), 'ABC');
      assert.equal(normaliseSupportImportMessage('&#0;'), '\u0000');
      assert.equal(
        normaliseSupportImportMessage('&#1114111;'),
        String.fromCodePoint(0x10ffff),
      );
      assert.equal(
        normaliseSupportImportMessage('&#x10ffff;'),
        String.fromCodePoint(0x10ffff),
      );
    });

    it('leaves out-of-range numeric entities alone', () => {
      for (const entity of [
        '&#1114112;',
        '&#x110000;',
        `&#${'9'.repeat(400)};`,
      ]) {
        assert.equal(normaliseSupportImportMessage(entity), entity);
      }
    });

    it('trims surrounding blank lines', () => {
      assert.equal(normaliseSupportImportMessage('\n\n hello \n\n'), 'hello');
    });

    it('normalises line endings, spacing and blank lines', () => {
      assert.equal(
        normaliseSupportImportMessage(
          '  one \t two \r\nthree\rfour\n\n\n\nfive  ',
        ),
        'one two\nthree\nfour\n\nfive',
      );
    });

    it('expands bare web addresses but not emails, phone numbers, mentions or hashtags', () => {
      assert.equal(
        normaliseSupportImportMessage('see www.example.org now'),
        'see http://www.example.org now',
      );
      assert.equal(
        normaliseSupportImportMessage(
          'a@example.org +1 415 555 2671 @someone #topic',
        ),
        'a@example.org +1 415 555 2671 @someone #topic',
      );
    });

    it('does not strip the protocol from explicit addresses', () => {
      assert.equal(
        normaliseSupportImportMessage('https://www.example.org/a'),
        'https://www.example.org/a',
      );
    });
  });

  describe('import hashes', () => {
    it('hashes the sender by trimmed lowercase email', () => {
      assert.equal(supportImportSenderHash(' A@B.ORG '), sha256('a@b.org'));
    });

    it('hashes the normalised message', () => {
      assert.equal(
        supportImportMessageHash('Hi &amp;\r\nyou  '),
        sha256('Hi &\nyou'),
      );
      assert.equal(supportImportMessageHash('héllo ✓'), sha256('héllo ✓'));
    });
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
      assert.equal(
        supportRequestImportFingerprints({
          category: 'other',
          email: 'a@example.org',
          message: 'plain text',
        }).length,
        1,
      );
    });
  });
});
