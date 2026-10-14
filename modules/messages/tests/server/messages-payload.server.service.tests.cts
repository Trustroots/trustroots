const assert: typeof import('assert/strict') = require('assert/strict');
const {
  prepareMarkReadSelector,
  prepareMarkReadResponse,
  prepareMessageForClient,
  prepareNewMessageFields,
  preparePreviewMessageResponse,
  prepareThreadSummary,
  prepareUnreadMessageCount,
} = require('../../server/services/messages-payload.server.service.mts');

describe('Message API payload construction', () => {
  it('selects only validated send fields and the authenticated sender', () => {
    assert.deepEqual(
      prepareNewMessageFields(
        {
          userTo: 'recipient-id',
          content: '<p>Hello</p>',
          read: false,
          spam: true,
        },
        'sender-id',
      ),
      {
        userTo: 'recipient-id',
        content: '<p>Hello</p>',
        userFrom: 'sender-id',
      },
    );
  });

  it('exposes only public message fields', () => {
    const message = {
      _id: 'message-id',
      content: '<p>Hello</p>',
      created: '2026-01-02T03:04:05.000Z',
      read: false,
      userFrom: { _id: 'sender-id', username: 'sample-sender' },
      userTo: { _id: 'recipient-id', username: 'sample-recipient' },
      spam: true,
      notified: true,
      shadowHidden: true,
    };
    assert.deepEqual(prepareMessageForClient(message), {
      _id: 'message-id',
      content: '<p>Hello</p>',
      created: '2026-01-02T03:04:05.000Z',
      read: false,
      userFrom: message.userFrom,
      userTo: message.userTo,
    });
  });

  it('scopes read updates to the intended recipient', () => {
    assert.deepEqual(
      prepareMarkReadSelector(['message-a', 'message-b'], 'recipient-id'),
      {
        $or: [
          { _id: 'message-a', userTo: 'recipient-id' },
          { _id: 'message-b', userTo: 'recipient-id' },
        ],
      },
    );
  });

  it('keeps only the excerpt in inbox summaries', () => {
    const thread = {
      _id: 'thread-id',
      read: true,
      updated: '2026-01-02T03:04:05.000Z',
      userFrom: { _id: 'sender-id' },
      userTo: { _id: 'recipient-id' },
      privateField: 'Internal data',
    };
    assert.deepEqual(prepareThreadSummary(thread, 'A fictional excerpt'), {
      _id: 'thread-id',
      read: true,
      updated: '2026-01-02T03:04:05.000Z',
      userFrom: thread.userFrom,
      userTo: thread.userTo,
      message: { excerpt: 'A fictional excerpt' },
    });
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
