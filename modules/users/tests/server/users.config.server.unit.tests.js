const should = require('should');
const sinon = require('sinon');
const mongoose = require('mongoose');
const passport = require('passport');
const config = require('../../../../config/config.mjs');

const controllerPath = '../../server/config/users.config.server.mjs';
require('../../server/models/user.server.model.mjs');
const User = mongoose.model('User');

async function installSessionHandlers() {
  let serialize;
  let deserialize;
  sinon
    .stub(passport, 'serializeUser')
    .callsFake(handler => (serialize = handler));
  sinon
    .stub(passport, 'deserializeUser')
    .callsFake(handler => (deserialize = handler));
  sinon.stub(config.utils, 'getGlobbedPaths').returns([]);
  const app = { use: sinon.stub() };

  await require(controllerPath)(app);

  return { serialize, deserialize };
}

describe('Users Passport session configuration', () => {
  afterEach(() => sinon.restore());

  it('serializes the authentication version and rejects legacy ID-only sessions', async () => {
    const user = { id: 'member-id', authVersion: 3 };
    const findOne = sinon.stub();
    sinon.stub(User, 'findOne').callsFake(findOne);
    const handlers = await installSessionHandlers();

    handlers.serialize(user, (serializeErr, session) => {
      should.not.exist(serializeErr);
      session.should.deepEqual({ id: 'member-id', authVersion: 3 });
      handlers.deserialize('member-id', (legacyErr, legacyUser) => {
        should.not.exist(legacyErr);
        should(legacyUser).equal(false);
        findOne.called.should.equal(false);
      });
    });
  });

  it('rejects stale versions and deleted accounts while accepting the current version', async () => {
    const currentUser = { id: 'member-id', authVersion: 4 };
    const findOne = sinon.stub().callsFake((query, fields, callback) => {
      if (query._id === 'deleted-id') {
        return callback(null, null);
      }
      return callback(null, currentUser);
    });
    sinon.stub(User, 'findOne').callsFake(findOne);
    const handlers = await installSessionHandlers();

    handlers.deserialize(
      { id: 'member-id', authVersion: 3 },
      (staleErr, staleUser) => {
        should.not.exist(staleErr);
        should(staleUser).equal(false);
        handlers.deserialize(
          { id: 'member-id', authVersion: 4 },
          (currentErr, restoredUser) => {
            should.not.exist(currentErr);
            restoredUser.should.equal(currentUser);
            handlers.deserialize(
              { id: 'deleted-id', authVersion: 0 },
              (deletedErr, deletedUser) => {
                should.not.exist(deletedErr);
                should(deletedUser).equal(null);
              },
            );
          },
        );
      },
    );
  });
});
