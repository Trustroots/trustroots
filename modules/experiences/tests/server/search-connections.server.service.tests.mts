import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import sinon from 'sinon';
import { findSearchConnectionIds } from '../../server/services/search-connections.server.service.mts';

function queryReturning<T>(result: T[]) {
  const query = {
    lean: () => query,
    maxTimeMS: () => query,
    exec: async () => result,
  };
  return query;
}

describe('Search connections service', () => {
  afterEach(() => sinon.restore());

  it('queries only the experience fields needed to calculate search connections', async () => {
    const viewerId = new mongoose.Types.ObjectId();
    const contactId = new mongoose.Types.ObjectId();
    const recommendedId = new mongoose.Types.ObjectId();
    const Contact = mongoose.model('Contact');
    const Experience = mongoose.model('Experience');
    const contactFind = sinon
      .stub(Contact, 'find')
      .returns(
        queryReturning([{ userFrom: contactId, userTo: viewerId }]) as never,
      );
    const experienceFind = sinon.stub(Experience, 'find').returns(
      queryReturning([
        {
          userFrom: viewerId,
          userTo: recommendedId,
          recommend: 'yes',
        },
      ]) as never,
    );

    assert.deepEqual(await findSearchConnectionIds(viewerId), [
      contactId,
      recommendedId,
    ]);
    assert.deepEqual(contactFind.firstCall.args[0], {
      confirmed: true,
      $or: [{ userFrom: viewerId }, { userTo: viewerId }],
    });
    assert.deepEqual(experienceFind.firstCall.args[0], {
      recommend: { $in: ['yes', 'no'] },
      removedAt: { $exists: false },
      $or: [{ userFrom: viewerId }, { userTo: viewerId, public: true }],
    });
    assert.deepEqual(experienceFind.firstCall.args[1], {
      _id: 0,
      userFrom: 1,
      userTo: 1,
      recommend: 1,
    });
  });
});
