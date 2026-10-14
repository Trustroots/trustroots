const should: typeof import('should') = require('should');
const sinon: typeof import('sinon') = require('sinon');
const mongoose: typeof import('mongoose') = require('mongoose');
interface SessionUser {
  id: string;
  authVersion?: number;
}
type SerializeHandler = (
  user: SessionUser,
  done: (error: Error | null, session: unknown) => void,
) => void;
type DeserializeHandler = (
  session: unknown,
  done: (error: Error | null, user: SessionUser | false | null) => void,
) => void;
const passport: {
  serializeUser(handler: SerializeHandler): void;
  deserializeUser(handler: DeserializeHandler): void;
  initialize(): unknown;
  session(): unknown;
} = require('passport');
const config: typeof import('../../../../config/config.mjs').default = require('../../../../config/config.mjs');

const controllerPath = '../../server/config/users.config.server.mjs';
require('../../server/models/user.server.model.mjs');
const User = mongoose.model('User');

async function installSessionHandlers() {
  let serialize: SerializeHandler | undefined;
  let deserialize: DeserializeHandler | undefined;
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

    if (!handlers.serialize || !handlers.deserialize)
      throw new Error('Passport handlers were not installed');
    const serialize = handlers.serialize;
    const deserialize = handlers.deserialize;
    serialize(user, (serializeErr: Error | null, session: unknown) => {
      should.not.exist(serializeErr);
      should(session).deepEqual({ id: 'member-id', authVersion: 3 });
      deserialize(
        'member-id',
        (legacyErr: Error | null, legacyUser: SessionUser | false | null) => {
          should.not.exist(legacyErr);
          should(legacyUser).equal(false);
          findOne.called.should.equal(false);
        },
      );
    });
  });

  it('rejects stale versions and deleted accounts while accepting the current version', async () => {
    const currentUser = { id: 'member-id', authVersion: 4 };
    const findOne = sinon
      .stub()
      .callsFake(
        (
          query: { _id: string },
          fields: string,
          callback: (
            error: Error | null,
            user: typeof currentUser | null,
          ) => void,
        ) => {
          if (query._id === 'deleted-id') {
            return callback(null, null);
          }
          return callback(null, currentUser);
        },
      );
    sinon.stub(User, 'findOne').callsFake(findOne);
    const handlers = await installSessionHandlers();

    if (!handlers.deserialize)
      throw new Error('Passport deserialize handler was not installed');
    const deserialize = handlers.deserialize;
    deserialize(
      { id: 'member-id', authVersion: 3 },
      (staleErr: Error | null, staleUser: SessionUser | false | null) => {
        should.not.exist(staleErr);
        should(staleUser).equal(false);
        deserialize(
          { id: 'member-id', authVersion: 4 },
          (
            currentErr: Error | null,
            restoredUser: SessionUser | false | null,
          ) => {
            should.not.exist(currentErr);
            should(restoredUser).equal(currentUser);
            deserialize(
              { id: 'deleted-id', authVersion: 0 },
              (
                deletedErr: Error | null,
                deletedUser: SessionUser | false | null,
              ) => {
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
