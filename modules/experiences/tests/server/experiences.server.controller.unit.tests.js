/**
 * Unit tests for experiences controller branches not covered by route tests.
 */
const mongoose = require('mongoose');
const sinon = require('sinon');

require('../../../contacts/server/models/contacts.server.model');
require('../../server/models/experiences.server.model');
const experiencesController = require('../../server/controllers/experiences.server.controller');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const Experience = mongoose.model('Experience');

function deferredResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
    resolveResponse = resolve;
  });
  const res = { statusCode: 200, body: null };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.send = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.json = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.waitForResponse = () => promise;
  return res;
}

describe('Experiences controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('create validation', () => {
    it('rejects missing interactions without unexpected interaction fields', async () => {
      const [viewer, target] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const res = deferredResponse();

      await experiencesController.create(
        {
          user: viewer,
          body: {
            userTo: target._id.toString(),
            recommend: 'yes',
          },
        },
        res,
        () => {},
      );

      res.statusCode.should.equal(400);
      res.body.details.interactions.any.should.equal('missing');
      res.body.details.should.not.have.property('fields');
    });
  });

  describe('getCount', () => {
    it('returns the experience count for another user', async () => {
      const [viewer, target] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      await new Experience({
        userFrom: viewer._id,
        userTo: target._id,
        public: true,
        recommend: 'yes',
        interactions: { met: true },
      }).save();

      const res = deferredResponse();
      experiencesController.getCount(
        { user: viewer, query: { userTo: target._id.toString() } },
        res,
        () => {},
      );
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      res.body.count.should.equal(1);
      res.body.should.not.have.property('hasPending');
    });

    it('includes pending experiences for the authenticated user', async () => {
      const [user] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      await new Experience({
        userFrom: new mongoose.Types.ObjectId(),
        userTo: user._id,
        public: false,
        recommend: 'yes',
        interactions: { met: true },
      }).save();

      const res = deferredResponse();
      experiencesController.getCount(
        { user, query: { userTo: user._id.toString() } },
        res,
        () => {},
      );
      await res.waitForResponse();

      res.body.count.should.equal(1);
      res.body.hasPending.should.be.true();
    });

    it('passes unexpected errors to next', async () => {
      const [user] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      sinon.stub(Experience, 'find').returns({
        count: () => {
          throw new Error('count failed');
        },
      });

      const nextArg = await new Promise(resolve => {
        experiencesController.getCount(
          { user, query: { userTo: user._id.toString() } },
          deferredResponse(),
          err => resolve(err),
        );
      });

      nextArg.should.be.Error();
      nextArg.message.should.equal('count failed');
    });
  });

  describe('getSuggestion', () => {
    it('passes database errors to next', async () => {
      const [user] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      const error = new Error('suggestion failed');
      sinon.stub(Experience, 'distinct').returns({
        exec: () => Promise.reject(error),
      });

      const nextArg = await new Promise(resolve => {
        experiencesController.getSuggestion({ user }, deferredResponse(), err =>
          resolve(err),
        );
      });

      nextArg.should.equal(error);
    });
  });
});
