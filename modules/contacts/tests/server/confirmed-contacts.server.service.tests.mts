import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import sinon from 'sinon';
import { findConfirmedContactIds } from '../../server/services/confirmed-contacts.server.service.mts';

function queryReturning<T>(result: T[]) {
  const query = {
    lean: () => query,
    maxTimeMS: () => query,
    exec: async () => result,
  };
  return query;
}

describe('Confirmed contacts service', () => {
  afterEach(() => sinon.restore());

  it('queries confirmed contacts in either direction with only the required fields', async () => {
    const viewerId = new mongoose.Types.ObjectId();
    const incomingId = new mongoose.Types.ObjectId();
    const outgoingId = new mongoose.Types.ObjectId();
    const Contact = mongoose.model('Contact');
    const find = sinon.stub(Contact, 'find').returns(
      queryReturning([
        { userFrom: incomingId, userTo: viewerId },
        { userFrom: viewerId, userTo: outgoingId },
      ]) as never,
    );

    assert.deepEqual(await findConfirmedContactIds(viewerId), [
      incomingId,
      outgoingId,
    ]);
    assert.deepEqual(find.firstCall.args[0], {
      confirmed: true,
      $or: [{ userFrom: viewerId }, { userTo: viewerId }],
    });
    assert.deepEqual(find.firstCall.args[1], {
      _id: 0,
      userFrom: 1,
      userTo: 1,
    });
  });
});
