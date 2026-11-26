import assert from 'assert/strict';
import {
  prepareMarkReadResponse,
  prepareMessageForClient,
  prepareNewMessageFields,
  preparePreviewMessageResponse,
  prepareUnreadMessageCount,
} from '../../server/services/messages-payload.server.service.mts';

const messageMetadata = { _id: 'message', created: new Date(0), read: false };

describe('Message API payload construction', () => {
  it('keeps hosting details out of ordinary messages', () => {
    const fields = prepareNewMessageFields(
      { userTo: 'recipient', content: 'Hello' },
      'sender',
    );

    assert.ok(!Object.hasOwn(fields, 'hostingDetails'));
    assert.ok(
      !Object.hasOwn(
        prepareMessageForClient({ ...messageMetadata, ...fields }),
        'hostingDetails',
      ),
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
      const hostingDetails = { ...details, internal: true };
      const projected = prepareMessageForClient({
        ...messageMetadata,
        ...fields,
        hostingDetails,
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
