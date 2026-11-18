import assert from 'assert/strict';
import {
  prepareMarkReadResponse,
  preparePreviewMessageResponse,
  prepareUnreadMessageCount,
} from '../../server/services/messages-payload.server.service.mts';

describe('Message API payload construction', () => {
  it('preserves count and preview response shapes', () => {
    assert.deepEqual(prepareUnreadMessageCount(3), { unread: 3 });
    assert.deepEqual(prepareUnreadMessageCount(0), { unread: 0 });
    assert.deepEqual(prepareMarkReadResponse(), {});
    assert.deepEqual(preparePreviewMessageResponse('<p>Draft</p>'), {
      content: '<p>Draft</p>',
    });
  });
});
