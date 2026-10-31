/**
 * Contacts controller behaviour when the underlying Mongoose calls reject.
 */
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

const contactsController = require('./../../server/controllers/contacts.server.controller.mjs');
const emailService = require('./../../../core/server/services/email.server.service.mjs');
const errorService = require('./../../../core/server/services/error.server.service.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
const should: typeof import('should') = require('should');

const User =
  mongoose.model<
    import('../../../../testutils/server/model-contracts.mts').UserRecord
  >('User');
const Contact =
  mongoose.model<
    import('../../../../testutils/server/model-contracts.mts').ContactRecord
  >('Contact');

const {
  deferredResponse,
}: typeof import('../../../../testutils/server/response.server.testutil.mts') = require('../../../../testutils/server/response.server.testutil.mts');

describe('Contacts controller mongoose error handling', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('add', () => {
    it('responds with 400 when loading the friend rejects', async () => {
      const [user1, user2] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(2, { public: true }),
      );
      sinon.stub(User, 'findOne').rejects(new Error('db down'));
      const sendBadRequest = sinon.spy(errorService, 'sendBadRequest');

      const res = deferredResponse();
      contactsController.add(
        { user: user1, body: { friendUserId: user2._id.toString() } },
        res,
      );
      await res.waitForResponse();

      res.statusCode.should.equal(400);
      sendBadRequest.firstCall.args[1].message.should.equal('db down');
    });

    it('still responds with 400 when removing the unsent contact rejects', async () => {
      const [user1, user2] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(2, { public: true }),
      );
      sinon
        .stub(emailService, 'sendConfirmContact')
        .callsFake((...args: unknown[]) => {
          const callback = args[args.length - 1];
          if (typeof callback !== 'function')
            throw new Error('Expected an email callback');
          callback(new Error('smtp down'));
        });
      sinon.stub(Contact.prototype, 'deleteOne').rejects(new Error('gone'));

      const res = deferredResponse();
      contactsController.add(
        { user: user1, body: { friendUserId: user2._id.toString() } },
        res,
      );
      await res.waitForResponse();

      res.statusCode.should.equal(400);
    });
  });

  describe('removeAllByUserId', () => {
    it('passes the error to the callback when deleteMany rejects', done => {
      const failure = new Error('delete failed');
      sinon.stub(Contact, 'deleteMany').rejects(failure);

      contactsController.removeAllByUserId(
        new mongoose.Types.ObjectId(),
        (err: unknown) => {
          should(err).equal(failure);
          done();
        },
      );
    });

    it('does not throw without a callback when deleteMany rejects', async () => {
      const stub = sinon.stub(Contact, 'deleteMany').rejects(new Error('fail'));

      contactsController.removeAllByUserId(new mongoose.Types.ObjectId());
      await new Promise(resolve => setImmediate(resolve));

      stub.calledOnce.should.be.true();
    });
  });
});
