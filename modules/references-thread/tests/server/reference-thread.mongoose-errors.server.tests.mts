import mongoose from 'mongoose';
import sinon from 'sinon';
import referenceController from './../../server/controllers/reference-thread.server.controller.mts';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
import should from 'should';
import {
  deferredResponse,
  type DeferredResponse,
} from '../../../../testutils/server/response.server.testutil.mts';
/**
 * Reference thread controller behaviour when the underlying Mongoose calls
 * reject.
 */

const Thread =
  mongoose.model<
    import('../../../../testutils/server/model-contracts.mts').ThreadRecord
  >('Thread');
const Message =
  mongoose.model<
    import('../../../../testutils/server/model-contracts.mts').MessageRecord
  >('Message');

describe('Reference thread controller mongoose error handling', () => {
  let author: import('../../../../testutils/server/model-contracts.mts').UserDocument;
  let other: import('../../../../testutils/server/model-contracts.mts').UserDocument;

  beforeEach(async () => {
    [author, other] = await utils.saveUsersWithCachedPasswords(
      utils.generateUsersWithSharedPassword(2, { public: true }),
    );
  });

  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  function create(res: DeferredResponse) {
    referenceController.createReferenceThread(
      {
        user: author,
        body: { userTo: other._id.toString(), reference: 'yes' },
      },
      res,
    );
    return res.waitForResponse();
  }

  it('responds with 400 when the thread lookup rejects', async () => {
    sinon.stub(Thread, 'findOne').rejects(new Error('db down'));

    const res = await create(deferredResponse());

    res.statusCode.should.equal(400);
    should(res.body).have.property('message', 'Thread does not exist.');
  });

  it('responds with 403 when the message lookup rejects', async () => {
    sinon.stub(Thread, 'findOne').resolves(
      new Thread({
        _id: new mongoose.Types.ObjectId(),
        userFrom: author._id,
        userTo: other._id,
      }),
    );
    sinon.stub(Message, 'findOne').rejects(new Error('db down'));

    const res = await create(deferredResponse());

    res.statusCode.should.equal(403);
  });
});
