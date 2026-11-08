const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const {
  linkHistoricalReport,
}: typeof import('../../server/services/report-link.server.service.mts') = require('../../server/services/report-link.server.service.mts');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');

const User = mongoose.model('User');
type ObjectId = import('mongoose').Types.ObjectId;
interface SupportRequestFields {
  reportedUser?: ObjectId;
  linkageEvidence?: string;
  [field: string]: unknown;
}
interface AuditLogFields {
  user?: ObjectId;
  route?: string;
  body?: unknown;
  [field: string]: unknown;
}
const SupportRequest = mongoose.model<SupportRequestFields>('SupportRequest');
const AuditLog = mongoose.model<AuditLogFields>('AuditLog');

const sent = new Date('2025-03-01T00:00:00Z');
const evidence = 'Verified immutable ID in archived correspondence.';

const MISSING_FIELDS =
  /^Error: Each mapping requires requestId, reportedUserId and historical identity evidence\.$/;
const NOT_ADMIN = /^Error: An administrator must verify historical mappings\.$/;
const NO_PAIR =
  /^Error: The historical report does not have a verifiable member pair\.$/;
const LINKED_ELSEWHERE =
  /^Error: The report is already linked to another member\.$/;

const createReport = (patch: Record<string, unknown>) =>
  SupportRequest.create({
    category: 'reportMember',
    sent: new Date('2025-03-02T00:00:00Z'),
    message: 'Fictional historical report',
    ...patch,
  });

describe('Historical support report linking', () => {
  let admin: ObjectId;
  let reporter: ObjectId;
  let target: ObjectId;
  let other: ObjectId;
  let report: ObjectId;
  let mapping: { requestId: string; reportedUserId: string; evidence: string };

  beforeEach(async () => {
    const users = await utils.saveUsersWithCachedPasswords(
      utils.generateUsersWithSharedPassword(4),
    );
    [admin, reporter, target, other] = users.map(user => user._id);
    await User.updateOne(
      { _id: admin },
      { $set: { roles: ['user', 'admin'] } },
    );
    await User.updateOne({ _id: target }, { $set: { created: sent } });
    await User.updateOne(
      { _id: { $in: [reporter, other] } },
      { $set: { created: new Date('2020-01-01T00:00:00Z') } },
    );
    report = (await createReport({ user: reporter }))._id;
    mapping = {
      requestId: report.toString(),
      reportedUserId: target.toString(),
      evidence,
    };
  });

  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });

  const apply = (patch: Record<string, unknown> = {}, actor: unknown = admin) =>
    linkHistoricalReport(
      { ...mapping, ...patch } as never,
      actor as never,
      true,
    );

  const saved = (id = report) => SupportRequest.findById(id).lean();
  const reportedUser = async (id = report) => (await saved(id))?.reportedUser;

  it('rejects malformed identifiers and evidence with a descriptive error', async () => {
    const valid = target.toString();
    const bad: unknown[] = [
      new mongoose.Types.ObjectId(),
      'abc',
      `${valid}0`,
      `x${valid}`,
      `${valid}x`,
      ` ${valid}`,
      undefined,
    ];
    for (const value of bad) {
      await assert.rejects(apply({ requestId: value }), MISSING_FIELDS);
      await assert.rejects(apply({ reportedUserId: value }), MISSING_FIELDS);
    }
    for (const value of [123, '', '   \n\t', undefined, null]) {
      await assert.rejects(apply({ evidence: value }), MISSING_FIELDS);
    }
    assert.equal(await reportedUser(), undefined);
    assert.equal(await AuditLog.countDocuments(), 0);
  });

  it('accepts uppercase hexadecimal identifiers', async () => {
    const result = await linkHistoricalReport(
      {
        ...mapping,
        requestId: mapping.requestId.toUpperCase(),
        reportedUserId: mapping.reportedUserId.toUpperCase(),
      },
      admin,
    );
    assert.equal(result.applied, false);
  });

  it('requires an existing administrator', async () => {
    // An id one hex digit away from the administrator's, never equal to it.
    const id = admin.toString();
    const nearAdmin = id.slice(0, -1) + (id.endsWith('0') ? '1' : '0');
    for (const actor of [reporter, new mongoose.Types.ObjectId(), nearAdmin]) {
      await assert.rejects(apply({}, actor), NOT_ADMIN);
    }
    assert.equal(await reportedUser(), undefined);
  });

  it('rejects reports without a verifiable reporter and reported member pair', async () => {
    const created = async (patch: Record<string, unknown>) =>
      (await createReport({ user: reporter, ...patch }))._id.toString();
    const newId = () => new mongoose.Types.ObjectId().toString();
    const targetId = target.toString();
    const cases: Array<[string, string, string]> = [
      ['missing report', newId(), targetId],
      ['wrong category', await created({ category: 'other' }), targetId],
      ['no reporter', await created({ user: undefined }), targetId],
      ['missing target', report.toString(), newId()],
      ['reporter is target', report.toString(), reporter.toString()],
      [
        'target joined after the report',
        await created({ sent: new Date('2025-02-28T23:59:59.999Z') }),
        targetId,
      ],
      [
        'reporter no longer exists',
        await created({ user: new mongoose.Types.ObjectId() }),
        targetId,
      ],
    ];
    for (const [name, requestId, reportedUserId] of cases) {
      await assert.rejects(
        apply({ requestId, reportedUserId, evidence }),
        NO_PAIR,
        name,
      );
    }
    assert.equal(await AuditLog.countDocuments(), 0);
  });

  it('accepts a target created at the very moment of the report', async () => {
    const exact = await createReport({ user: reporter, sent });
    await apply({ requestId: exact._id.toString() });
    assert.equal(String(await reportedUser(exact._id)), target.toString());
  });

  it('rejects a report that is already linked to another member', async () => {
    await SupportRequest.updateOne(
      { _id: report },
      { $set: { reportedUser: other } },
    );
    await assert.rejects(apply(), LINKED_ELSEWHERE);
    assert.equal(String(await reportedUser()), other.toString());
    assert.equal(await AuditLog.countDocuments(), 0);
  });

  it('only previews the link unless applying', async () => {
    const result = await linkHistoricalReport(mapping, admin);
    assert.deepEqual(result, {
      requestId: mapping.requestId,
      reportedUserId: mapping.reportedUserId,
      applied: false,
    });
    assert.equal(await reportedUser(), undefined);
    assert.equal(await AuditLog.countDocuments(), 0);
  });

  it('links the report, stores trimmed evidence and audits the mapping', async () => {
    const unrelated = await SupportRequest.create({
      category: 'reportMember',
      user: reporter,
      message: 'Fictional unrelated report',
    });
    const result = await apply({ evidence: `  ${evidence}\n` });
    assert.deepEqual(result, {
      requestId: mapping.requestId,
      reportedUserId: mapping.reportedUserId,
      applied: true,
    });
    const linked = await saved();
    assert.equal(String(linked?.reportedUser), target.toString());
    assert.equal(linked?.linkageEvidence, evidence);
    assert.equal(await reportedUser(unrelated._id), undefined);
    const logs = await AuditLog.find().lean();
    assert.equal(logs.length, 1);
    assert.equal(String(logs[0].user), admin.toString());
    assert.equal(logs[0].route, 'maintenance/link-support-report');
    assert.deepEqual(logs[0].body, { ...mapping, evidence });
  });

  it('refreshes the evidence when the same member is linked again', async () => {
    await apply();
    await apply({ evidence: 'Second verified source.' });
    const linked = await saved();
    assert.equal(String(linked?.reportedUser), target.toString());
    assert.equal(linked?.linkageEvidence, 'Second verified source.');
  });

  it('does not overwrite a link written by someone else after the check', async () => {
    const create = AuditLog.create.bind(AuditLog);
    sinon.stub(AuditLog, 'create').callsFake((async (...args: unknown[]) => {
      await SupportRequest.updateOne(
        { _id: report },
        { $set: { reportedUser: other } },
      );
      return (create as (...a: unknown[]) => unknown)(...args);
    }) as never);
    await apply();
    const linked = await saved();
    assert.equal(String(linked?.reportedUser), other.toString());
    assert.equal(linked?.linkageEvidence, undefined);
  });
});
