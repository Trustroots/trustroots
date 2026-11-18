import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
import mockModule from '../../../../testutils/server/mock-module.mts';

// Reload aggregation expressions inside each test so mutation testing exercises them.
function freshService() {
  return mockModule<
    typeof import('../../server/services/support-migration.server.service.mts')
  >(
    new URL(
      '../../server/services/support-migration.server.service.mts',
      import.meta.url,
    ),
    {},
  );
}

interface RawSupportRequest {
  _id: import('mongoose').Types.ObjectId;
  category?: string | null;
  reportMember?: unknown;
  status?: string;
  statusRevision?: number;
  lastActivityAt?: Date;
  sent: Date;
  message: string;
}

describe('support inbox compatibility migration', () => {
  const collection = () =>
    mongoose.model<RawSupportRequest>('SupportRequest').collection;
  const sentAt = (day: number) => new Date(Date.UTC(2020, 0, day));
  const ids = Array.from({ length: 8 }, () => new mongoose.Types.ObjectId());

  // Raw documents, so that schema defaults cannot hide the legacy shapes.
  // resolved: 1, 2. No status: 3, 4, 5. No lastActivityAt: 2, 3, 4, 7.
  // No usable category: 2, 3, 4, 6, 7, 8.
  const messages = 'one two three four five six seven eight'.split(' ');
  const legacyRequests: RawSupportRequest[] = [
    {
      category: 'other',
      status: 'resolved',
      statusRevision: 3,
      lastActivityAt: sentAt(11),
    },
    { reportMember: 'fictional-target', status: 'resolved' },
    { category: '', reportMember: '   ' },
    { category: null, reportMember: 7 },
    {
      category: 'account',
      reportMember: 'ignored-because-category-exists',
      lastActivityAt: sentAt(15),
    },
    { reportMember: '', status: 'open', lastActivityAt: sentAt(16) },
    { category: '', status: 'open', statusRevision: 0 },
    {
      reportMember: '  padded-target  ',
      status: 'open',
      lastActivityAt: sentAt(18),
    },
  ].map((fields, index) => ({
    _id: ids[index]!,
    sent: sentAt(index + 1),
    message: messages[index]!,
    ...fields,
  }));
  const SUMMARY = {
    resolved: 2,
    missing: 3,
    missingActivity: 4,
    missingCategory: 6,
  };

  beforeEach(async () => {
    await collection().insertMany(legacyRequests);
  });

  afterEach(async () => {
    await utils.clearDatabase();
  });

  const stored = async () =>
    new Map(
      (await collection().find({}).toArray()).map(request => [
        String(request._id),
        request,
      ]),
    );

  it('counts what needs migrating without changing anything by default', async () => {
    assert.deepEqual(await (await freshService()).migrateSupportInbox(), {
      ...SUMMARY,
      applied: false,
    });
    assert.deepEqual(await collection().find({}).sort({ sent: 1 }).toArray(), [
      ...legacyRequests,
    ]);
  });

  it('migrates statuses, activity, revisions and categories when applied', async () => {
    assert.deepEqual(await (await freshService()).migrateSupportInbox(true), {
      ...SUMMARY,
      applied: true,
    });
    const requests = await stored();
    const byIndex = ids.map(id => requests.get(String(id))!);

    assert.deepEqual(
      byIndex.map(request => request.status),
      ['solved', 'solved', 'open', 'open', 'open', 'open', 'open', 'open'],
    );
    assert.deepEqual(
      byIndex.map(request => request.category),
      'other reportMember other other account other other reportMember'.split(
        ' ',
      ),
    );
    assert.deepEqual(
      byIndex.map(request => request.lastActivityAt),
      [11, 2, 3, 4, 15, 16, 7, 18].map(sentAt),
    );
    assert.deepEqual(
      byIndex.map(request => request.statusRevision),
      [3, 0, 0, 0, 0, 0, 0, 0],
    );
    assert.equal(byIndex[7]!.reportMember, '  padded-target  ');
  });

  it('is repeatable: a second run finds nothing left to migrate', async () => {
    await (await freshService()).migrateSupportInbox(true);
    const before = await stored();
    assert.deepEqual(await (await freshService()).migrateSupportInbox(true), {
      resolved: 0,
      missing: 0,
      missingActivity: 0,
      missingCategory: 0,
      applied: true,
    });
    assert.deepEqual(await stored(), before);
  });
});
