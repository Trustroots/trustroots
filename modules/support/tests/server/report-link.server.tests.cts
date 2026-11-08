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
    const created = await SupportRequest.create({
      category: 'reportMember',
      user: reporter,
      sent: new Date('2025-03-02T00:00:00Z'),
      message: 'Fictional historical report',
    });
    report = created._id;
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

  async function reportedUser(id = report) {
    return (await SupportRequest.findById(id).lean())?.reportedUser;
  }

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
      await assert.rejects(
        linkHistoricalReport(
          { ...mapping, requestId: value as string },
          admin,
          true,
        ),
        MISSING_FIELDS,
      );
      await assert.rejects(
        linkHistoricalReport(
          { ...mapping, reportedUserId: value as string },
          admin,
          true,
        ),
        MISSING_FIELDS,
      );
    }
    for (const value of [123, '', '   \n\t', undefined, null]) {
      await assert.rejects(
        linkHistoricalReport(
          { ...mapping, evidence: value as unknown as string },
          admin,
          true,
        ),
        MISSING_FIELDS,
      );
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
    for (const actor of [
      reporter,
      new mongoose.Types.ObjectId(),
      admin.toString().replace(/.$/, '0'),
    ]) {
      await assert.rejects(
        linkHistoricalReport(mapping, actor, true),
        NOT_ADMIN,
      );
    }
    assert.equal(await reportedUser(), undefined);
  });

  it('rejects reports without a verifiable reporter and reported member pair', async () => {
    const created = (patch: Record<string, unknown>) =>
      SupportRequest.create({
        category: 'reportMember',
        user: reporter,
        sent: new Date('2025-03-02T00:00:00Z'),
        message: 'Fictional historical report',
        ...patch,
      });
    const cases: Array<[string, string, string]> = [
      [
        'missing report',
        new mongoose.Types.ObjectId().toString(),
        target.toString(),
      ],
      [
        'wrong category',
        (await created({ category: 'other' }))._id.toString(),
        target.toString(),
      ],
      [
        'no reporter',
        (await created({ user: undefined }))._id.toString(),
        target.toString(),
      ],
      [
        'missing target',
        report.toString(),
        new mongoose.Types.ObjectId().toString(),
      ],
      ['reporter is target', report.toString(), reporter.toString()],
      [
        'target joined after the report',
        (
          await created({ sent: new Date('2025-02-28T23:59:59.999Z') })
        )._id.toString(),
        target.toString(),
      ],
      [
        'reporter no longer exists',
        (await created({ user: new mongoose.Types.ObjectId() }))._id.toString(),
        target.toString(),
      ],
    ];
    for (const [name, requestId, reportedUserId] of cases) {
      await assert.rejects(
        linkHistoricalReport(
          { requestId, reportedUserId, evidence },
          admin,
          true,
        ),
        NO_PAIR,
        name,
      );
    }
    assert.equal(await AuditLog.countDocuments(), 0);
  });

  it('accepts a target created at the very moment of the report', async () => {
    const exact = await SupportRequest.create({
      category: 'reportMember',
      user: reporter,
      sent,
      message: 'Fictional historical report',
    });
    await linkHistoricalReport(
      { ...mapping, requestId: exact._id.toString() },
      admin,
      true,
    );
    assert.equal(String(await reportedUser(exact._id)), target.toString());
  });

  it('rejects a report that is already linked to another member', async () => {
    await SupportRequest.updateOne(
      { _id: report },
      { $set: { reportedUser: other } },
    );
    await assert.rejects(
      linkHistoricalReport(mapping, admin, true),
      LINKED_ELSEWHERE,
    );
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
    const other = await SupportRequest.create({
      category: 'reportMember',
      user: reporter,
      message: 'Fictional unrelated report',
    });
    const result = await linkHistoricalReport(
      { ...mapping, evidence: `  ${evidence}\n` },
      admin,
      true,
    );
    assert.deepEqual(result, {
      requestId: mapping.requestId,
      reportedUserId: mapping.reportedUserId,
      applied: true,
    });
    const saved = await SupportRequest.findById(report).lean();
    assert.equal(String(saved?.reportedUser), target.toString());
    assert.equal(saved?.linkageEvidence, evidence);
    assert.equal(
      (await SupportRequest.findById(other._id).lean())?.reportedUser,
      undefined,
    );
    const logs = await AuditLog.find().lean();
    assert.equal(logs.length, 1);
    assert.equal(String(logs[0].user), admin.toString());
    assert.equal(logs[0].route, 'maintenance/link-support-report');
    assert.deepEqual(logs[0].body, { ...mapping, evidence });
  });

  it('refreshes the evidence when the same member is linked again', async () => {
    await linkHistoricalReport(mapping, admin, true);
    await linkHistoricalReport(
      { ...mapping, evidence: 'Second verified source.' },
      admin,
      true,
    );
    const saved = await SupportRequest.findById(report).lean();
    assert.equal(String(saved?.reportedUser), target.toString());
    assert.equal(saved?.linkageEvidence, 'Second verified source.');
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
    await linkHistoricalReport(mapping, admin, true);
    const saved = await SupportRequest.findById(report).lean();
    assert.equal(String(saved?.reportedUser), other.toString());
    assert.equal(saved?.linkageEvidence, undefined);
  });
});
