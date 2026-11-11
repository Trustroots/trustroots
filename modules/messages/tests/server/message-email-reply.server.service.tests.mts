import assert from 'node:assert/strict';
import {
  extractReplyText,
  maxReplyBytes,
  validateReplyEmail,
  type ReplyEmailInput,
} from '../../server/services/message-email-reply.server.service.mts';

const validInput: ReplyEmailInput = {
  from: ['member@example.test'],
  to: ['reply+token@example.test'],
  text: 'Thanks, I can make it.',
  truncated: false,
  expectedSender: 'member@example.test',
  expectedReplyAddress: 'reply+token@example.test',
};

describe('message email reply text', () => {
  it('removes the explicit reply marker and everything after it', () => {
    assert.equal(
      extractReplyText(
        'My reply\n--- Reply above this line ---\nOriginal notification',
      ),
      'My reply',
    );
  });

  it('stops at the first standard quoted block', () => {
    assert.equal(
      extractReplyText('First line\n> quoted line\nsecond quoted line'),
      'First line',
    );
  });

  it('stops at a familiar On-wrote marker but keeps other quoted text', () => {
    assert.equal(
      extractReplyText('Reply\nOn Tuesday, someone wrote:\n> prior reply'),
      'Reply',
    );
    assert.equal(
      extractReplyText('Reply\nA previous message said this'),
      'Reply\nA previous message said this',
    );
  });

  it('trims the extracted reply', () => {
    assert.equal(extractReplyText(' \n  Reply text  \n\n'), 'Reply text');
  });
});

describe('validateReplyEmail', () => {
  it('accepts one matching sender and recipient and returns the extracted reply', () => {
    assert.deepEqual(
      validateReplyEmail({
        ...validInput,
        from: ['member@Example.Test'],
        to: [' reply+token@Example.Test '],
        autoSubmitted: ' No ',
        text: 'Thanks\n> quoted notification',
      }),
      { ok: true, replyText: 'Thanks' },
    );
  });

  it('rejects an ambiguous sender or recipient', () => {
    assert.deepEqual(validateReplyEmail({ ...validInput, from: [] }), {
      ok: false,
      reason: 'ambiguous-from',
    });
    assert.deepEqual(
      validateReplyEmail({
        ...validInput,
        from: ['member@example.test', 'other@example.test'],
      }),
      { ok: false, reason: 'ambiguous-from' },
    );
    assert.deepEqual(
      validateReplyEmail({
        ...validInput,
        to: ['reply+token@example.test', 'other@example.test'],
      }),
      { ok: false, reason: 'ambiguous-to' },
    );
  });

  it('rejects invalid expected addresses and sender or reply-address mismatches', () => {
    assert.deepEqual(
      validateReplyEmail({ ...validInput, expectedSender: 'not-an-address' }),
      { ok: false, reason: 'invalid-address' },
    );
    assert.deepEqual(
      validateReplyEmail({
        ...validInput,
        expectedReplyAddress: 'reply@@example.test',
      }),
      { ok: false, reason: 'invalid-address' },
    );
    assert.deepEqual(
      validateReplyEmail({
        ...validInput,
        expectedSender: 'member\u0000@example.test',
      }),
      { ok: false, reason: 'invalid-address' },
    );
    assert.deepEqual(
      validateReplyEmail({ ...validInput, from: ['other@example.test'] }),
      { ok: false, reason: 'sender-mismatch' },
    );
    assert.deepEqual(
      validateReplyEmail({ ...validInput, from: ['Member@example.test'] }),
      { ok: false, reason: 'sender-mismatch' },
    );
    assert.deepEqual(
      validateReplyEmail({ ...validInput, to: ['other@example.test'] }),
      { ok: false, reason: 'reply-address-mismatch' },
    );
    assert.deepEqual(
      validateReplyEmail({ ...validInput, to: ['reply+TOKEN@example.test'] }),
      { ok: false, reason: 'reply-address-mismatch' },
    );
  });

  it('rejects automated or truncated messages', () => {
    assert.deepEqual(
      validateReplyEmail({ ...validInput, autoSubmitted: 'auto-replied' }),
      { ok: false, reason: 'automated' },
    );
    assert.deepEqual(validateReplyEmail({ ...validInput, truncated: true }), {
      ok: false,
      reason: 'truncated',
    });
  });

  it('rejects bodies over the UTF-8 byte limit', () => {
    assert.deepEqual(
      validateReplyEmail({
        ...validInput,
        text: 'é'.repeat(Math.floor(maxReplyBytes / 2) + 1),
      }),
      { ok: false, reason: 'oversized' },
    );
  });

  it('rejects empty replies after quoted content is removed', () => {
    assert.deepEqual(
      validateReplyEmail({ ...validInput, text: '> entire body is quoted' }),
      { ok: false, reason: 'empty' },
    );
    assert.deepEqual(validateReplyEmail({ ...validInput, text: '  \n\t  ' }), {
      ok: false,
      reason: 'empty',
    });
  });
});
