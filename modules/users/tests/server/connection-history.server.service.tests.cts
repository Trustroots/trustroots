const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const should: typeof import('should') = require('should');
require('../../server/models/user.server.model.mjs');

const User = mongoose.model('User');
const service: typeof import('../../server/services/connection-history.server.service.mts') = require('../../server/services/connection-history.server.service.mts');
type UserDocument =
  import('../../server/models/user.server.types.mts').UserServerDocument;
type UserRecord =
  import('../../server/models/user.server.types.mts').UserServerRecord;

function trackedUser(options?: {
  values?: Record<string, unknown>;
  snapshot?: Record<string, string>;
  modifiedPaths?: string[];
  isNew?: boolean;
}): UserDocument {
  const modifiedPaths = options?.modifiedPaths || [];
  return {
    _id: new mongoose.Types.ObjectId(),
    isNew: options?.isNew || false,
    $locals: { connectionSnapshot: options?.snapshot || {} },
    isModified: (path: string) => modifiedPaths.includes(path),
    markModified: sinon.spy(),
    ...(options?.values || {}),
  } as unknown as UserDocument;
}

function stubPersisted(record: Partial<UserRecord> | null) {
  const query = {
    select: sinon.stub(),
    lean: sinon.stub(),
    exec: sinon.stub().resolves(record),
  };
  query.select.returns(query);
  query.lean.returns(query);
  sinon.stub(User, 'findById').returns(query as never);
  return query;
}

describe('connection history service', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('adds current connections to a new account as ordinary changes', async function () {
    const user = trackedUser({
      isNew: true,
      values: {
        extSitesServas: 'household/Family',
        nostrNpub: 'npub1example',
      },
    });

    await service.trackConnectionHistoryBeforeSave(user);

    user.connectionHistory?.should.deepEqual([
      {
        network: 'servas',
        oldIdentifier: null,
        newIdentifier: 'household/Family',
        changedAt: user.connectionHistory?.[0]?.changedAt,
        initial: false,
      },
      {
        network: 'nostr',
        oldIdentifier: null,
        newIdentifier: 'npub1example',
        changedAt: user.connectionHistory?.[1]?.changedAt,
        initial: false,
      },
    ]);
    should(user.connectionHistoryInitialised).equal(true);
    should(user.connectionHistoryRevision).equal(1);
    user.connectionSearchKeys?.should.deepEqual([
      'servas:household/Family',
      'nostr:npub1example',
    ]);
  });

  it('does not query for saves without changed identity paths', async function () {
    const user = trackedUser();
    sinon.stub(User, 'findById');

    await service.trackConnectionHistoryBeforeSave(user);

    (User.findById as sinon.SinonStub).called.should.equal(false);
  });

  it('CAS-checks a normalised no-op connection change without adding history', async function () {
    const user = trackedUser({
      values: { extSitesCouchers: 'Member' },
      snapshot: { couchers: 'member' },
      modifiedPaths: ['extSitesCouchers'],
    });
    stubPersisted({
      _id: user._id,
      extSitesCouchers: 'member',
      connectionHistoryInitialised: true,
      connectionHistoryRevision: 3,
      connectionHistory: [],
    } as unknown as UserRecord);

    await service.trackConnectionHistoryBeforeSave(user);

    user.connectionHistory?.should.have.length(0);
    should(user.connectionHistoryRevision).equal(4);
    user.$where.should.deepEqual({ connectionHistoryRevision: 3 });
    user.connectionSearchKeys?.should.containEql('couchers:member');
  });

  it('rejects stale sibling provider identifiers when the Mixed provider object changes', async function () {
    const user = trackedUser({
      values: {
        additionalProvidersData: { twitter: undefined },
      },
      snapshot: { github: 'old-github', twitter: 'old-twitter' },
      modifiedPaths: ['additionalProvidersData'],
    });
    stubPersisted({
      _id: user._id,
      additionalProvidersData: {
        github: { login: 'new-github' },
        twitter: { screen_name: 'old-twitter' },
      },
      connectionHistoryInitialised: true,
    } as UserRecord);

    await service
      .trackConnectionHistoryBeforeSave(user)
      .should.be.rejectedWith(service.ConnectionHistoryConflictError);
  });

  it('fails if the account was deleted before the changed connection could be saved', async function () {
    const user = trackedUser({
      values: { extSitesCouchers: 'new-member' },
      snapshot: { couchers: 'old-member' },
      modifiedPaths: ['extSitesCouchers'],
    });
    stubPersisted(null);

    await service
      .trackConnectionHistoryBeforeSave(user)
      .should.be.rejectedWith(mongoose.Error.DocumentNotFoundError);
  });

  it('rejects a stale connection snapshot before recording changes', async function () {
    const user = trackedUser({
      values: { extSitesCouchers: 'new-member' },
      snapshot: { couchers: 'old-member' },
      modifiedPaths: ['extSitesCouchers'],
    });
    stubPersisted({
      _id: user._id,
      extSitesCouchers: 'concurrent-member',
      connectionHistoryInitialised: true,
    } as UserRecord);

    await service
      .trackConnectionHistoryBeforeSave(user)
      .should.be.rejectedWith(service.ConnectionHistoryConflictError);
  });

  it('initialises an old snapshot and records its first change with a revision CAS', async function () {
    const user = trackedUser({
      values: {
        extSitesCouchers: 'new-member',
        additionalProvidersData: {
          github: { login: 'new-github' },
        },
      },
      snapshot: {
        couchers: 'old-member',
        github: 'old-github',
      },
      modifiedPaths: ['extSitesCouchers'],
    });
    stubPersisted({
      _id: user._id,
      extSitesCouchers: 'old-member',
      additionalProvidersData: {
        github: { login: 'old-github' },
      },
      connectionHistoryRevision: 4,
    } as UserRecord);

    await service.trackConnectionHistoryBeforeSave(user);

    user.connectionHistory
      ?.map(({ network, oldIdentifier, newIdentifier, initial }) => ({
        network,
        oldIdentifier,
        newIdentifier,
        initial,
      }))
      .should.deepEqual([
        {
          network: 'couchers',
          oldIdentifier: null,
          newIdentifier: 'old-member',
          initial: true,
        },
        {
          network: 'github',
          oldIdentifier: null,
          newIdentifier: 'old-github',
          initial: true,
        },
        {
          network: 'couchers',
          oldIdentifier: 'old-member',
          newIdentifier: 'new-member',
          initial: false,
        },
      ]);
    should(user.connectionHistoryInitialised).equal(true);
    should(user.connectionHistoryRevision).equal(5);
    user.$where.should.deepEqual({ connectionHistoryRevision: 4 });
    user.connectionSearchKeys?.should.containEql('couchers:old-member');
    user.connectionSearchKeys?.should.containEql('couchers:new-member');
    user.connectionSearchKeys?.should.containEql('github:old-github');
  });

  it('uses the missing-revision CAS filter and preserves existing history', async function () {
    const user = trackedUser({
      values: { nostrNpub: 'npub1new' },
      snapshot: { nostr: 'npub1old' },
      modifiedPaths: ['nostrNpub'],
    });
    stubPersisted({
      _id: user._id,
      nostrNpub: 'npub1old',
      connectionHistoryInitialised: true,
      connectionHistory: [
        {
          network: 'nostr',
          oldIdentifier: null,
          newIdentifier: 'npub1older',
          changedAt: null,
          initial: true,
        },
      ],
    } as UserRecord);

    await service.trackConnectionHistoryBeforeSave(user);

    user.connectionHistory?.should.have.length(2);
    should(user.connectionHistory?.[0]?.newIdentifier).equal('npub1older');
    should(user.connectionHistory?.[1]?.oldIdentifier).equal('npub1old');
    should(user.connectionHistory?.[1]?.newIdentifier).equal('npub1new');
    user.$where.should.deepEqual({
      connectionHistoryRevision: { $exists: false },
    });
    should(user.connectionHistoryRevision).equal(1);
  });

  it('captures a private immutable connection snapshot', function () {
    const user = trackedUser({
      values: {
        extSitesServas: 'household/Family',
        additionalProvidersData: { twitter: { screen_name: 'Member' } },
      },
    });

    service.captureConnectionSnapshot(user);

    should(
      (user.$locals as Record<string, unknown>).connectionSnapshot,
    ).deepEqual({
      servas: 'household/Family',
      twitter: 'Member',
    });
  });

  it('clears only the history CAS condition after a successful save', function () {
    const user = trackedUser();
    user.$where = { username: 'former-name', connectionHistoryRevision: 3 };

    service.clearConnectionHistoryCas(user);

    user.$where.should.deepEqual({ username: 'former-name' });
    service.clearConnectionHistoryCas(trackedUser());
  });

  it('clears the query condition when the CAS condition was its only field', function () {
    const user = trackedUser();
    user.$where = { connectionHistoryRevision: 1 };

    service.clearConnectionHistoryCas(user);

    user.$where.should.deepEqual({});
  });

  it('builds an idempotent initial state including pre-existing history', function () {
    const entry = {
      network: 'github' as const,
      oldIdentifier: 'old-login',
      newIdentifier: null,
      changedAt: new Date('2020-01-01T00:00:00.000Z'),
      initial: false,
    };
    const first = service.initialConnectionHistoryState({
      extSitesBW: 'Member',
      connectionHistory: [entry],
    });
    first.connectionHistory.should.have.length(2);
    first.connectionSearchKeys.should.containEql('github:old-login');
    first.connectionSearchKeys.should.containEql('bewelcome:member');
    service
      .initialConnectionHistoryState({
        extSitesBW: 'Member',
        connectionHistory: first.connectionHistory,
      })
      .connectionSearchKeys.should.deepEqual(first.connectionSearchKeys);
  });
});
