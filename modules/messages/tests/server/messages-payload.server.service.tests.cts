const assert: typeof import('assert/strict') = require('assert/strict');
const {
  prepareMarkReadResponse,
  prepareMessageForClient,
  prepareNewMessageFields,
  preparePreviewMessageResponse,
  prepareUnreadMessageCount,
} = require('../../server/services/messages-payload.server.service.mts');

describe('Message API payload construction', () => {
  it('keeps hosting details out of ordinary messages', () => {
    const fields = prepareNewMessageFields(
      { userTo: 'recipient', content: 'Hello' },
      'sender',
    );

    assert.ok(!Object.hasOwn(fields, 'hostingDetails'));
    assert.ok(
      !Object.hasOwn(prepareMessageForClient(fields), 'hostingDetails'),
    );
  });

  it('persists and projects optional hosting details without internal fields', () => {
    for (const details of [
      { guests: 1 },
      { guests: 2, arrival: '2028-02-29', departure: '2028-03-02' },
    ]) {
      const fields = prepareNewMessageFields(
        { userTo: 'host', content: 'Hello', hostingDetails: details },
        'guest',
      );
      assert.deepEqual(fields.hostingDetails, details);
      const projected = prepareMessageForClient({
        ...fields,
        hostingDetails: { ...details, internal: true },
      });
      assert.deepEqual(projected.hostingDetails, details);
    }
  });
  it('preserves count and preview response shapes', () => {
    assert.deepEqual(prepareUnreadMessageCount(3), { unread: 3 });
    assert.deepEqual(prepareUnreadMessageCount(0), { unread: 0 });
    assert.deepEqual(prepareMarkReadResponse(), {});
    assert.deepEqual(preparePreviewMessageResponse('<p>Draft</p>'), {
      content: '<p>Draft</p>',
    });
  });
});
