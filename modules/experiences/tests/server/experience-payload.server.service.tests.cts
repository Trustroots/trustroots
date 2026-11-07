const assert: typeof import('assert/strict') = require('assert/strict');
const { ObjectId } = require('mongoose').Types;
const {
  prepareSendingToClient,
} = require('../../server/services/experience-payload.server.service.cjs');

describe('Experience API payload construction', () => {
  const author = new ObjectId('111111111111111111111111');
  const recipient = new ObjectId('222222222222222222222222');
  const experience = {
    _id: new ObjectId('333333333333333333333333'),
    created: new Date('2026-01-01T12:00:00Z'),
    public: false,
    userFrom: author,
    userTo: recipient,
    interactions: { guest: false, host: true, met: true, privateField: true },
    recommend: 'yes',
    feedbackPublic: 'A fictional experience.',
    privateField: 'Internal data',
  };

  it('keeps private feedback hidden from the recipient', () => {
    assert.deepEqual(prepareSendingToClient(experience, null, recipient), {
      _id: experience._id,
      created: experience.created,
      public: false,
      userFrom: author,
      userTo: recipient,
      response: null,
    });
  });
});
