const proxyquire = require('proxyquire').noCallThru();
const should = require('should');
const sinon = require('sinon');

const controllerPath = '../../server/config/users.config.server';

function installSessionHandlers(User) {
  let serialize;
  let deserialize;
  const passport = {
    serializeUser(handler) {
      serialize = handler;
    },
    deserializeUser(handler) {
      deserialize = handler;
    },
    initialize: () => () => {},
    session: () => () => {},
  };
  const app = { use: sinon.stub() };

  proxyquire(controllerPath, {
    passport,
    mongoose: { model: () => User },
    '../../../../config/config': {
      utils: { getGlobbedPaths: () => [] },
    },
    '../controllers/users.suspended.server.controller': {
      invalidateSuspendedSessions: () => {},
    },
  })(app);

  return { serialize, deserialize };
}

describe('Users Passport session configuration', () => {
  afterEach(() => sinon.restore());

  it('serializes the authentication version and rejects legacy ID-only sessions', done => {
    const user = { id: 'member-id', authVersion: 3 };
    const findOne = sinon.stub();
    const handlers = installSessionHandlers({ findOne });

    handlers.serialize(user, (serializeErr, session) => {
      should.not.exist(serializeErr);
      session.should.deepEqual({ id: 'member-id', authVersion: 3 });
      handlers.deserialize('member-id', (legacyErr, legacyUser) => {
        should.not.exist(legacyErr);
        should(legacyUser).equal(false);
        findOne.called.should.equal(false);
        done();
      });
    });
  });

  it('rejects stale versions and deleted accounts while accepting the current version', done => {
    const currentUser = { id: 'member-id', authVersion: 4 };
    const findOne = sinon.stub().callsFake((query, fields, callback) => {
      if (query._id === 'deleted-id') {
        return callback(null, null);
      }
      return callback(null, currentUser);
    });
    const handlers = installSessionHandlers({ findOne });

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
                done();
              },
            );
          },
        );
      },
    );
  });
});
