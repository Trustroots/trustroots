/**
 * Offers controller behaviour when the underlying Mongoose calls reject.
 */
import mongoose from 'mongoose';
import sinon from 'sinon';

import offersController from './../../server/controllers/offers.server.controller.mts';
import should from 'should';

const Offer =
  mongoose.model<
    import('../../../../testutils/server/model-contracts.mts').OfferRecord
  >('Offer');

describe('Offers controller mongoose error handling', () => {
  afterEach(() => sinon.restore());

  describe('removeAllByUserId', () => {
    it('passes the error to the callback when deleteMany rejects', done => {
      const failure = new Error('delete failed');
      sinon.stub(Offer, 'deleteMany').rejects(failure);

      offersController.removeAllByUserId(
        new mongoose.Types.ObjectId(),
        (err: unknown) => {
          should(err).equal(failure);
          done();
        },
      );
    });

    it('does not throw without a callback when deleteMany rejects', async () => {
      const stub = sinon.stub(Offer, 'deleteMany').rejects(new Error('fail'));

      offersController.removeAllByUserId(new mongoose.Types.ObjectId());
      await new Promise(resolve => setImmediate(resolve));

      stub.calledOnce.should.be.true();
    });
  });
});
