const assert = require('assert/strict');
const { ObjectId } = require('mongoose').Types;
const {
  prepareExperienceCount,
  prepareNewExperience,
  prepareSendingToClient,
} = require('../../server/services/experience-payload.server.service.mjs');

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

  it('exposes the author’s feedback with bare member IDs and strips internal fields', () => {
    const payload = prepareSendingToClient(experience, null, author);
    assert.equal(payload.feedbackPublic, experience.feedbackPublic);
    assert.deepEqual(payload.interactions, {
      guest: false,
      host: true,
      met: true,
    });
    assert.equal('privateField' in payload, false);
    assert.equal(payload.userFrom, author);
  });

  it('supports public populated members and selects only reciprocal feedback', () => {
    const populated = {
      ...experience,
      public: true,
      userFrom: { _id: author, username: 'sample-author' },
      userTo: { _id: recipient, username: 'sample-recipient' },
    };
    const response = {
      ...experience,
      _id: new ObjectId('444444444444444444444444'),
      userFrom: recipient,
      userTo: author,
    };
    const payload = prepareSendingToClient(populated, response, recipient);
    assert.equal(payload.userFrom, populated.userFrom);
    assert.equal(payload.feedbackPublic, experience.feedbackPublic);
    assert.deepEqual(payload.response, {
      _id: response._id,
      created: response.created,
      interactions: { guest: false, host: true, met: true },
      recommend: response.recommend,
      feedbackPublic: response.feedbackPublic,
    });
  });

  it('preserves an absent optional feedback field', () => {
    const withoutFeedback = { ...experience };
    delete withoutFeedback.feedbackPublic;
    const payload = prepareSendingToClient(
      withoutFeedback,
      withoutFeedback,
      author,
    );
    assert.equal('feedbackPublic' in payload, false);
    assert.equal('feedbackPublic' in payload.response, false);
  });

  it('preserves validated request fields and authoritative author/visibility', () => {
    const body = {
      userTo: recipient.toString(),
      interactions: { met: true },
      recommend: 'unknown',
      feedbackPublic: '',
      userFrom: recipient,
      public: true,
    };
    assert.deepEqual(prepareNewExperience(body, author, false), {
      ...body,
      userFrom: author,
      public: false,
    });
  });

  it('includes pending counts only on the member’s own profile', () => {
    assert.deepEqual(prepareExperienceCount(2, 0, false), { count: 2 });
    assert.deepEqual(prepareExperienceCount(2, 1, true), {
      count: 3,
      hasPending: true,
    });
    assert.deepEqual(prepareExperienceCount(0, 0, true), {
      count: 0,
      hasPending: false,
    });
  });
});
