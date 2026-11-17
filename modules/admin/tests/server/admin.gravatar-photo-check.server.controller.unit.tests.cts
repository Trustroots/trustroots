const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const mockModule: typeof import('../../../../testutils/server/mock-module.mts').default = require('../../../../testutils/server/mock-module');
const {
  setImmediate: drain,
}: typeof import('node:timers/promises') = require('node:timers/promises');

const User = mongoose.model('User');
const controllerPath =
  require.resolve('../../server/controllers/admin.gravatar-photo-check.server.controller.mts');
const cleanupPath =
  '../../../users/server/services/gravatar-cleanup.server.service.mts';
type Controller =
  typeof import('../../server/controllers/admin.gravatar-photo-check.server.controller.mts');

function loadController(
  checkGravatarPhoto: () => Promise<'unavailable'>,
  clearMissingGravatar: () => Promise<boolean>,
) {
  return mockModule<Controller>(controllerPath, {
    [cleanupPath]: { checkGravatarPhoto, clearMissingGravatar },
  });
}

function response() {
  const captured: { status?: number; body?: Record<string, unknown> } = {};
  const res = {
    status(status: number) {
      captured.status = status;
      return res;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return res;
    },
  };
  return { captured, res };
}

function stubMemberQuery() {
  const member = {
    _id: new mongoose.Types.ObjectId(),
    emailHash: 'a'.repeat(32),
    avatarVersion: 'version-1',
  };
  const cursor = {
    async *[Symbol.asyncIterator]() {
      yield member;
    },
  };
  const projections: unknown[] = [];
  sinon.stub(User, 'find').returns({
    select(projection: unknown) {
      projections.push(projection);
      return {
        lean() {
          return { cursor: () => cursor };
        },
      };
    },
  } as never);
  return { member, projections };
}

describe('Admin Gravatar photo check controller', () => {
  afterEach(() => sinon.restore());

  it('loads avatar versions and counts retired photos during cleanup', async () => {
    const { member, projections } = stubMemberQuery();
    const checkPhoto = sinon.stub().resolves('unavailable');
    const clearPhoto = sinon.stub().resolves(true);
    const controller = loadController(checkPhoto, clearPhoto);
    const { captured, res } = response();

    controller.startPhotoCheck(
      { query: { cleanup: '1' } } as never,
      res as never,
    );
    await drain();

    assert.deepEqual(projections, [{ emailHash: 1, avatarVersion: 1 }]);
    sinon.assert.calledOnceWithExactly(checkPhoto, member.emailHash);
    sinon.assert.calledOnceWithExactly(clearPhoto, member);
    assert.equal(captured.status, 202);
    assert.equal(captured.body?.state, 'complete');
    assert.equal(captured.body?.retired, 1);
  });

  it('does not retire photos during a check without cleanup mode', async () => {
    const { member, projections } = stubMemberQuery();
    const checkPhoto = sinon.stub().resolves('unavailable');
    const clearPhoto = sinon.stub().resolves(true);
    const controller = loadController(checkPhoto, clearPhoto);
    const { captured, res } = response();

    controller.startPhotoCheck({ query: {} } as never, res as never);
    await drain();

    assert.deepEqual(projections, [{ emailHash: 1, _id: 0 }]);
    sinon.assert.calledOnceWithExactly(checkPhoto, member.emailHash);
    sinon.assert.notCalled(clearPhoto);
    assert.equal(captured.body?.state, 'complete');
    assert.equal(Object.hasOwn(captured.body ?? {}, 'retired'), false);
  });
});
