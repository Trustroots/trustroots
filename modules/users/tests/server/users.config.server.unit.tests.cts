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
type Middleware = (
  req: { path: string },
  res: unknown,
  next: () => void,
) => void;
const passport: {
  serializeUser(handler: SerializeHandler): void;
  deserializeUser(handler: DeserializeHandler): void;
  initialize(): unknown;
  session(): unknown;
  use(strategy: { name: string }): unknown;
} = require('passport');
const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const usersSuspended: typeof import('../../server/controllers/users.suspended.server.controller.mts').default = require('../../server/controllers/users.suspended.server.controller.mts');

const controllerPath = '../../server/config/users.config.server.mts';
require('../../server/models/user.server.model.mjs');
const User = mongoose.model('User');

async function installSessionHandlers(loadStrategies = false) {
  let serialize: SerializeHandler | undefined;
  let deserialize: DeserializeHandler | undefined;
  sinon
    .stub(passport, 'serializeUser')
    .callsFake(handler => (serialize = handler));
  sinon
    .stub(passport, 'deserializeUser')
    .callsFake(handler => (deserialize = handler));
  if (!loadStrategies) sinon.stub(config.utils, 'getGlobbedPaths').returns([]);
  const app = { use: sinon.stub() };

  await require(controllerPath)(app);

  if (!serialize || !deserialize)
    throw new Error('Passport handlers were not installed');
  const restore = (session: unknown) =>
    new Promise<SessionUser | false | null>((resolve, reject) =>
      deserialize!(session, (error, user) =>
        error ? reject(error) : resolve(user),
      ),
    );
  return { serialize, deserialize, restore, app };
}

describe('Users Passport session configuration', () => {
  afterEach(() => sinon.restore());

  it('serializes the authentication version and rejects malformed sessions', async () => {
    const findOne = sinon.stub();
    sinon.stub(User, 'findOne').callsFake(findOne);
    const { serialize, restore } = await installSessionHandlers();

    serialize({ id: 'member-id', authVersion: 3 }, (error, session) => {
      should.not.exist(error);
      should(session).deepEqual({ id: 'member-id', authVersion: 3 });
    });
    serialize({ id: 'member-id' }, (error, session) =>
      should(session).deepEqual({ id: 'member-id', authVersion: 0 }),
    );
    for (const session of [
      null,
      undefined,
      'member-id',
      // Not an object, even though it carries both fields.
      Object.assign(() => {}, { id: 'member-id', authVersion: 0 }),
      { id: 'member-id' },
      { authVersion: 0 },
      { id: 'member-id', authVersion: 1.5 },
    ]) {
      should(await restore(session)).equal(false);
    }
    findOne.called.should.equal(false);
  });

  it('rejects stale versions and deleted accounts while accepting the current version', async () => {
    const currentUser = { id: 'member-id', authVersion: 4 };
    const findOne = sinon
      .stub()
      .callsFake(async (query: { _id: string }) =>
        query._id === 'deleted-id' ? null : currentUser,
      );
    sinon.stub(User, 'findOne').callsFake(findOne);
    const { restore } = await installSessionHandlers();

    should(await restore({ id: 'member-id', authVersion: 3 })).equal(false);
    should(await restore({ id: 'member-id', authVersion: 4 })).equal(
      currentUser,
    );
    should(await restore({ id: 'deleted-id', authVersion: 0 })).equal(null);
    findOne
      .alwaysCalledWithMatch(sinon.match.object, '-salt -password')
      .should.be.true();
  });

  it('reports a failed session lookup without restoring a user', async () => {
    const failure = new Error('Session lookup failed');
    sinon.stub(User, 'findOne').rejects(failure);
    const { deserialize } = await installSessionHandlers();
    const result = await new Promise<{
      error: Error | null;
      user: SessionUser | false | null;
    }>(resolve =>
      deserialize({ id: 'member-id', authVersion: 1 }, (error, user) =>
        resolve({ error, user }),
      ),
    );

    should(result.error).equal(failure);
    should(result.user).equal(false);
  });

  it('installs the strategies and keeps browser sessions off the mobile API', async () => {
    const strategies = sinon.stub(passport, 'use');
    sinon.stub(passport, 'initialize').returns('initialize');
    const browserSession = sinon.stub();
    sinon.stub(passport, 'session').returns(browserSession);
    const { app } = await installSessionHandlers(true);

    strategies.args
      .map(([strategy]) => strategy.name)
      .should.deepEqual(['local']);
    app.use.args.should.have.length(3);
    should(app.use.args[0]).deepEqual(['initialize']);
    should(app.use.args[2]).deepEqual([
      usersSuspended.invalidateSuspendedSessions,
    ]);
    const browserSessionOnly: Middleware = app.use.args[1][0];
    for (const [path, mobile] of [
      ['/api/mobile/v0', true],
      ['/api/mobile/v0/messages', true],
      ['/api/mobile/v01', false],
      ['/x/api/mobile/v0', false],
    ] as const) {
      browserSession.resetHistory();
      const next = sinon.spy();
      browserSessionOnly({ path }, {}, next);
      next.called.should.equal(mobile);
      browserSession.called.should.equal(!mobile);
    }
  });
});
