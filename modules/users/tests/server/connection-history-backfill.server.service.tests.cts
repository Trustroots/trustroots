const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const should: typeof import('should') = require('should');
require('../../server/models/user.server.model.mjs');

const User =
  mongoose.model<
    import('../../server/models/user.server.types.mts').UserServerRecord
  >('User');
const service: typeof import('../../server/services/connection-history-backfill.server.service.mts') = require('../../server/services/connection-history-backfill.server.service.mts');
type UserRecord =
  import('../../server/models/user.server.types.mts').UserServerRecord;

function record(overrides: Record<string, unknown> = {}): UserRecord {
  return {
    _id: new mongoose.Types.ObjectId(),
    extSitesCouchers: undefined,
    extSitesBW: undefined,
    extSitesCS: undefined,
    extSitesWS: undefined,
    extSitesServas: undefined,
    nostrNpub: undefined,
    connectionHistoryInitialised: undefined,
    ...overrides,
  } as unknown as UserRecord;
}

function lookupQuery(result: UserRecord | null) {
  const query = {
    select: sinon.stub(),
    lean: sinon.stub(),
    exec: sinon.stub().resolves(result),
  };
  query.select.returns(query);
  query.lean.returns(query);
  return query;
}

function updates(...matched: number[]) {
  const update = sinon.stub();
  matched.forEach((count, index) => {
    update.onCall(index).returns({
      exec: async () => ({ matchedCount: count }),
    } as never);
  });
  sinon.stub(User, 'updateOne').callsFake(update as never);
  return update;
}

describe('connection history backfill service', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('atomically initialises current identifiers and is idempotent', async function () {
    const existing = record({
      extSitesBW: 'FormerMember',
      extSitesServas: 'household/Family',
      additionalProvidersData: {
        github: { login: 'OldLogin' },
      },
    });
    sinon.stub(User, 'findById').returns(lookupQuery(existing) as never);
    const update = updates(1);

    (
      await service.initialiseConnectionHistoryForUser(User, existing._id)
    ).should.be.true();

    update.calledOnce.should.be.true();
    const filter = update.firstCall.args[0] as Record<string, unknown>;
    should(filter.connectionHistoryInitialised).deepEqual({ $ne: true });
    should(filter.extSitesBW).equal('FormerMember');
    should(filter.extSitesServas).equal('household/Family');
    should(filter.additionalProvidersData).deepEqual({
      github: { login: 'OldLogin' },
    });
    const write = update.firstCall.args[1] as {
      $set: Record<string, unknown>;
    };
    should(write.$set.connectionHistoryInitialised).equal(true);
    should(write.$set.connectionHistoryRevision).equal(1);
    (write.$set.connectionHistory as Array<{ initial: boolean }>)
      .map(entry => entry.initial)
      .should.deepEqual([true, true, true]);
  });

  it('skips accounts that are deleted or already initialised', async function () {
    const deleted = record();
    const initialized = record({ connectionHistoryInitialised: true });
    const find = sinon.stub(User, 'findById');
    find.onFirstCall().returns(lookupQuery(null) as never);
    find.onSecondCall().returns(lookupQuery(initialized) as never);
    const update = sinon.stub(User, 'updateOne');

    (
      await service.initialiseConnectionHistoryForUser(User, deleted._id)
    ).should.be.false();
    (
      await service.initialiseConnectionHistoryForUser(User, initialized._id)
    ).should.be.false();

    update.called.should.be.false();
  });

  it('re-reads after a CAS miss and observes concurrent completion', async function () {
    const pending = record();
    const initialized = record({ connectionHistoryInitialised: true });
    const find = sinon.stub(User, 'findById');
    find.onFirstCall().returns(lookupQuery(pending) as never);
    find.onSecondCall().returns(lookupQuery(initialized) as never);
    updates(0);

    (
      await service.initialiseConnectionHistoryForUser(User, pending._id)
    ).should.be.false();
    find.calledTwice.should.be.true();
  });

  it('retries with fresh identifiers after a competing profile update', async function () {
    const first = record({ extSitesBW: 'first-member' });
    const second = record({
      _id: first._id,
      extSitesBW: 'second-member',
    });
    const find = sinon.stub(User, 'findById');
    find.onFirstCall().returns(lookupQuery(first) as never);
    find.onSecondCall().returns(lookupQuery(second) as never);
    const update = updates(0, 1);

    (
      await service.initialiseConnectionHistoryForUser(User, first._id)
    ).should.be.true();

    update.calledTwice.should.be.true();
    should(
      (update.secondCall.args[0] as Record<string, unknown>).extSitesBW,
    ).equal('second-member');
    const secondWrite = update.secondCall.args[1] as {
      $set: Record<string, unknown>;
    };
    should(
      (
        secondWrite.$set.connectionHistory as Array<{ newIdentifier: string }>
      )[0]?.newIdentifier,
    ).equal('second-member');
  });

  it('fails after repeated CAS conflicts', async function () {
    const pending = record();
    sinon.stub(User, 'findById').callsFake(() => lookupQuery(pending) as never);
    updates(0, 0, 0, 0, 0);

    await service
      .initialiseConnectionHistoryForUser(User, pending._id)
      .should.be.rejectedWith(
        'Could not initialise external connection history after retries.',
      );
  });

  it('closes its cursor even if a yielded account disappears', async function () {
    const yielded = record();
    const cursor = {
      close: sinon.stub().resolves(),
      async *[Symbol.asyncIterator]() {
        yield yielded;
      },
    };
    const query = {
      select: sinon.stub(),
      lean: sinon.stub(),
      cursor: sinon.stub().returns(cursor),
    };
    query.select.returns(query);
    query.lean.returns(query);
    sinon.stub(User, 'find').returns(query as never);
    sinon.stub(User, 'findById').returns(lookupQuery(null) as never);

    (await service.backfillConnectionHistory(User)).should.equal(0);

    cursor.close.calledOnce.should.be.true();
  });
});
