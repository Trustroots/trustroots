import type { Types } from 'mongoose';
import type { SupportStatusImportPreviewRecord } from '../../server/models/support-status-import-preview.server.model.mts';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const {
  applyPreview,
  previewReducedManifest,
}: typeof import('../../server/services/status-import.server.service.mts') = require('../../server/services/status-import.server.service.mts');
const {
  supportImportMessageHash,
  supportImportSenderHash,
  supportRequestFingerprint,
}: typeof import('../../server/services/support-fingerprint.server.service.mts') = require('../../server/services/support-fingerprint.server.service.mts');

interface SupportRequestFixture {
  _id: Types.ObjectId;
  category: string;
  email: string;
  message: string;
  reportMember?: string;
  username?: string;
  subject?: string;
  status: string;
  statusRevision: number;
  statusChangedAt?: Date;
  lastActivityAt?: Date;
  sent: Date;
  zendeskTicketId?: number | null;
  resolvedAt?: Date | null;
}

interface AuditFixture {
  user: Types.ObjectId;
  route: string;
  params: unknown;
  body: unknown;
}

const SupportRequest = mongoose.model<SupportRequestFixture>('SupportRequest');
const AuditLog = mongoose.model<AuditFixture>('AuditLog');
const User = mongoose.model('User');
const PreviewModel = mongoose.model<SupportStatusImportPreviewRecord>(
  'SupportStatusImportPreview',
);

const MANIFEST_ERROR = {
  status: 400,
  message: 'Invalid support status manifest.',
};
const SELECTION_ERROR = {
  status: 400,
  message: 'Invalid support status selection.',
};
const ONE_TO_ONE = {
  status: 400,
  message: 'Support status selections must be one-to-one.',
};
const NOT_SUGGESTED = {
  status: 400,
  message: 'Selected support request is not a suggested match.',
};
const SUGGESTION_REASON =
  'same sender, same category, submitted within the selected window, equivalent message after formatting normalisation';
const HEX64 = 'a'.repeat(64);
const UPDATED_AT = '2025-01-01T00:00:00.000Z';
const EXPORTED_AT = '2025-06-01T00:00:00.000Z';
const MINUTE = 60_000;

describe('conservative support status import: behaviour guards', () => {
  let adminId: Types.ObjectId;
  let supportRequest: SupportRequestFixture;
  const input = {
    category: 'other' as const,
    email: 'visitor@example.org',
    message: 'A fictional request for help.',
  };
  const sent = new Date('2024-01-01T00:00:00.000Z');

  beforeEach(async () => {
    const generated = utils.generateUsersWithSharedPassword(1);
    generated[0]!.roles = ['user', 'admin'];
    const [admin] = await utils.saveUsers(generated);
    adminId = admin!._id;
    supportRequest = await SupportRequest.create({
      ...input,
      status: 'open',
      sent,
    });
  });

  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });

  function item(overrides: Record<string, unknown> = {}) {
    return {
      zendeskTicketId: 789,
      status: 'pending',
      updatedAt: UPDATED_AT,
      fingerprint: supportRequestFingerprint(input),
      ...overrides,
    };
  }

  function v1(
    itemOverrides: Record<string, unknown> = {},
    overrides: Record<string, unknown> = {},
  ) {
    return {
      version: 1,
      exportedAt: EXPORTED_AT,
      items: [item(itemOverrides)],
      ...overrides,
    };
  }

  function evidence(
    message: string,
    submittedAt: Date | null = sent,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      senderHash: supportImportSenderHash(input.email),
      category: 'other',
      submittedAt: submittedAt === null ? null : submittedAt.toISOString(),
      normalisedMessageHash: supportImportMessageHash(message),
      ...overrides,
    };
  }

  /** A v2 item whose fingerprint matches nothing, so only evidence can match it. */
  function evidenceItem(
    zendeskTicketId: number,
    message: string,
    submittedAt: Date | null = sent,
    overrides: Record<string, unknown> = {},
  ) {
    return item({
      zendeskTicketId,
      fingerprint: supportRequestFingerprint({
        ...input,
        message: `Source text of ticket ${zendeskTicketId}.`,
      }),
      evidence: evidence(message, submittedAt),
      ...overrides,
    });
  }

  function v2(items: unknown[], overrides: Record<string, unknown> = {}) {
    return { version: 2, exportedAt: EXPORTED_AT, items, ...overrides };
  }

  async function stored(previewId: string) {
    return (await PreviewModel.findById(previewId).lean())!;
  }

  async function storedRequest(id: Types.ObjectId = supportRequest._id) {
    return (await SupportRequest.findById(id).lean())!;
  }

  async function createRequest(
    message: string,
    fields: Record<string, unknown> = {},
  ) {
    return SupportRequest.create({
      ...input,
      message,
      status: 'open',
      sent,
      ...fields,
    });
  }

  function auditFor(route: string) {
    return AuditLog.findOne({ route }).lean();
  }

  describe('manifest validation', () => {
    const v2Item = (evidenceOverrides: Record<string, unknown> = {}) =>
      item({
        evidence: {
          senderHash: HEX64,
          category: 'other',
          submittedAt: UPDATED_AT,
          normalisedMessageHash: HEX64,
          ...evidenceOverrides,
        },
      });

    it('rejects every malformed manifest with a 400', async () => {
      const decorate = (value: Record<string, unknown>) =>
        Object.assign([], value);
      const cases: Array<[string, unknown]> = [
        ['a string', 'manifest'],
        ['an array', []],
        ['an unknown version', v1({}, { version: 3 })],
        ['a string version', v1({}, { version: '1' })],
        ['an extra top-level key', v1({}, { extra: true })],
        ['a missing top-level key', { version: 1, items: [item()] }],
        ['a numeric exportedAt', v1({}, { exportedAt: 1_735_689_600_000 })],
        ['a null exportedAt', v1({}, { exportedAt: null })],
        ['an object exportedAt', v1({}, { exportedAt: {} })],
        ['a blank exportedAt', v1({}, { exportedAt: '   ' })],
        ['non-array items', v1({}, { items: {} })],
        ['a numeric updatedAt', v1({ updatedAt: 1_735_689_600_000 })],
        ['a null updatedAt', v1({ updatedAt: null })],
        ['an object updatedAt', v1({ updatedAt: {} })],
        ['an unparseable updatedAt', v1({ updatedAt: 'yesterday' })],
        ['a non-object item (number)', v1({}, { items: [5] })],
        ['a null item', v1({}, { items: [null] })],
        ['a string item', v1({}, { items: ['item'] })],
        [
          'an array item carrying the right keys',
          v1({}, { items: [decorate(item())] }),
        ],
        ['an extra item key', v1({ extra: 1 })],
        [
          'a renamed item key',
          v1({ fingerprints: HEX64, fingerprint: undefined }),
        ],
        ['a fractional ticket id', v1({ zendeskTicketId: 1.5 })],
        ['a string ticket id', v1({ zendeskTicketId: '789' })],
        ['a zero ticket id', v1({ zendeskTicketId: 0 })],
        ['a negative ticket id', v1({ zendeskTicketId: -3 })],
        ['an unsafe ticket id', v1({ zendeskTicketId: 2 ** 53 })],
        ['an unknown status', v1({ status: 'escalated' })],
        ['a numeric fingerprint', v1({ fingerprint: 5 })],
        ['an array fingerprint', v1({ fingerprint: [HEX64] })],
        ['a short fingerprint', v1({ fingerprint: 'a'.repeat(63) })],
        ['a long fingerprint', v1({ fingerprint: 'a'.repeat(65) })],
        ['a prefixed fingerprint', v1({ fingerprint: `g${HEX64}` })],
        ['a suffixed fingerprint', v1({ fingerprint: `${HEX64}g` })],
        ['an uppercase fingerprint', v1({ fingerprint: 'A'.repeat(64) })],
        ['v1 items carrying evidence', v1({ evidence: {} })],
        ['v2 items without evidence', v2([item()])],
        ['an unknown version with v2 items', v2([v2Item()], { version: 3 })],
        ['version zero with v2 items', v2([v2Item()], { version: 0 })],
      ];
      for (const [label, source] of cases) {
        await assert.rejects(
          previewReducedManifest(source, adminId),
          MANIFEST_ERROR,
          label,
        );
      }
      assert.equal(await PreviewModel.countDocuments(), 0);
    });

    it('rejects malformed v2 evidence with a 400', async () => {
      const wrap = (evidenceValue: unknown) =>
        v2([item({ evidence: evidenceValue })]);
      const valid = {
        senderHash: HEX64,
        category: 'other',
        submittedAt: UPDATED_AT,
        normalisedMessageHash: HEX64,
      };
      const cases: Array<[string, unknown]> = [
        ['null evidence', wrap(null)],
        ['numeric evidence', wrap(5)],
        ['string evidence', wrap('evidence')],
        [
          'array evidence carrying the right keys',
          wrap(Object.assign([], valid)),
        ],
        ['an extra evidence key', wrap({ ...valid, extra: 1 })],
        [
          'a missing evidence key',
          wrap({ senderHash: HEX64, category: 'other', submittedAt: null }),
        ],
        ['a numeric senderHash', v2([v2Item({ senderHash: 5 })])],
        ['an array senderHash', v2([v2Item({ senderHash: [HEX64] })])],
        ['a short senderHash', v2([v2Item({ senderHash: 'a'.repeat(63) })])],
        ['a prefixed senderHash', v2([v2Item({ senderHash: `g${HEX64}` })])],
        ['a suffixed senderHash', v2([v2Item({ senderHash: `${HEX64}g` })])],
        [
          'a numeric normalisedMessageHash',
          v2([v2Item({ normalisedMessageHash: 5 })]),
        ],
        [
          'an array normalisedMessageHash',
          v2([v2Item({ normalisedMessageHash: [HEX64] })]),
        ],
        [
          'a prefixed normalisedMessageHash',
          v2([v2Item({ normalisedMessageHash: `g${HEX64}` })]),
        ],
        [
          'a suffixed normalisedMessageHash',
          v2([v2Item({ normalisedMessageHash: `${HEX64}g` })]),
        ],
        ['an unknown category', v2([v2Item({ category: 'nonsense' })])],
        ['an inherited category', v2([v2Item({ category: 'toString' })])],
        ['an array category', v2([v2Item({ category: ['other'] })])],
        ['a numeric category', v2([v2Item({ category: 5 })])],
        ['an unparseable submittedAt', v2([v2Item({ submittedAt: 'later' })])],
        ['a numeric submittedAt', v2([v2Item({ submittedAt: 1_735_689_600 })])],
        ['an undefined submittedAt', v2([v2Item({ submittedAt: undefined })])],
      ];
      for (const [label, source] of cases) {
        await assert.rejects(
          previewReducedManifest(source, adminId),
          MANIFEST_ERROR,
          label,
        );
      }
    });

    it('accepts the smallest ticket id, null submission times and the item limit', async () => {
      const smallest = await previewReducedManifest(
        v1({ zendeskTicketId: 1 }),
        adminId,
      );
      assert.equal(smallest.counts.eligible, 1);
      assert.equal(smallest.changes[0]?.zendeskTicketId, 1);

      const nullTime = await previewReducedManifest(
        v2([evidenceItem(5, input.message, null)]),
        adminId,
      );
      assert.equal(nullTime.counts.skippedByReason['no-match'], 1);

      const full = await previewReducedManifest(
        v1(
          {},
          {
            items: Array.from({ length: 10_000 }, (_, index) =>
              item({ zendeskTicketId: index + 1 }),
            ),
          },
        ),
        adminId,
      );
      assert.equal(full.counts.total, 10_000);
    });
  });

  describe('administrator checks', () => {
    const FORBIDDEN = {
      status: 403,
      message: 'An administrator must import support statuses.',
    };

    it('answers 403 for unknown users, users without roles and non-admins', async () => {
      await assert.rejects(
        previewReducedManifest(v1(), new mongoose.Types.ObjectId()),
        FORBIDDEN,
      );
      const [member] = await utils.saveUsers(
        utils.generateUsersWithSharedPassword(1),
      );
      await assert.rejects(
        previewReducedManifest(v1(), member!._id),
        FORBIDDEN,
      );
      await User.collection.updateOne(
        { _id: member!._id },
        { $unset: { roles: '' } },
      );
      await assert.rejects(
        previewReducedManifest(v1(), member!._id),
        FORBIDDEN,
      );
      const preview = await previewReducedManifest(v1(), adminId);
      await assert.rejects(
        applyPreview(preview.previewId, member!._id),
        FORBIDDEN,
      );
      await assert.rejects(
        applyPreview(preview.previewId, new mongoose.Types.ObjectId()),
        FORBIDDEN,
      );
    });
  });

  describe('preview', () => {
    it('keeps a preview for exactly thirty minutes', async () => {
      // The lifetime is a module constant: load a fresh copy under this test.
      const servicePath =
        require.resolve('../../server/services/status-import.server.service.mts');
      delete require.cache[servicePath];
      const fresh: typeof import('../../server/services/status-import.server.service.mts') = require(
        servicePath,
      );
      const preview = await fresh.previewReducedManifest(v1(), adminId);
      const doc = await stored(preview.previewId);
      assert.equal(
        doc.expiresAt.getTime() - doc.createdAt.getTime(),
        30 * MINUTE,
      );
      assert.equal(preview.expiresAt, doc.expiresAt.toISOString());
    });

    it('describes an exact change completely', async () => {
      const preview = await previewReducedManifest(v1(), adminId);
      assert.deepEqual(preview.changes, [
        {
          requestId: String(supportRequest._id),
          zendeskTicketId: 789,
          currentStatus: 'open',
          importedStatus: 'pending',
          updatedAt: UPDATED_AT,
          matchKind: 'exact',
          reason: 'exact request fingerprint',
        },
      ]);
      assert.deepEqual(preview.matchReviews, []);
      assert.deepEqual(preview.counts, {
        total: 1,
        eligible: 1,
        suggested: 0,
        alreadyApplied: 0,
        skipped: 0,
        skippedByReason: {},
      });
      const [entry] = (await stored(preview.previewId)).entries;
      assert.equal(entry?.state, 'ready');
      assert.equal(String(entry?.requestId), String(supportRequest._id));
      assert.equal(
        entry?.originalFingerprint,
        supportRequestFingerprint(input),
      );
    });

    it('does not fail on legacy requests without a stored message', async () => {
      await SupportRequest.collection.updateOne(
        { _id: supportRequest._id },
        { $unset: { message: '' } },
      );
      const preview = await previewReducedManifest(
        v2([evidenceItem(5, input.message)]),
        adminId,
      );
      assert.equal(preview.counts.skippedByReason['no-match'], 1);
    });

    it('treats activity exactly at the imported time as not newer, and anything later as newer', async () => {
      const updatedAt = new Date(UPDATED_AT);
      for (const field of ['lastActivityAt', 'statusChangedAt', 'sent']) {
        await SupportRequest.collection.updateOne(
          { _id: supportRequest._id },
          { $set: { [field]: updatedAt } },
        );
        const atBoundary = await previewReducedManifest(v1(), adminId);
        assert.equal(atBoundary.counts.eligible, 1, field);

        await SupportRequest.collection.updateOne(
          { _id: supportRequest._id },
          { $set: { [field]: new Date(updatedAt.getTime() + 1) } },
        );
        const later = await previewReducedManifest(v1(), adminId);
        assert.equal(
          later.counts.skippedByReason['newer-local-activity'],
          1,
          field,
        );
        await SupportRequest.collection.updateOne(
          { _id: supportRequest._id },
          { $set: { [field]: sent } },
        );
      }
    });

    it('treats a matching ticket id with a different status as a change, not as applied', async () => {
      await SupportRequest.updateOne(
        { _id: supportRequest._id },
        { $set: { zendeskTicketId: 789 } },
      );
      const preview = await previewReducedManifest(v1(), adminId);
      assert.equal(preview.counts.eligible, 1);
      assert.equal(preview.counts.alreadyApplied, 0);
      assert.deepEqual(await applyPreview(preview.previewId, adminId), {
        applied: 1,
        alreadyApplied: 0,
        skipped: 0,
      });
      assert.equal((await storedRequest()).status, 'pending');
    });

    it('records the audit trail without personal data', async () => {
      const scenario = await mixedScenario();
      const preview = await previewReducedManifest(scenario.manifest, adminId);
      const log = await auditFor('support-status-import/preview');
      assert.equal(String(log?.user), String(adminId));
      assert.deepEqual(log?.params, { previewId: preview.previewId });
      assert.deepEqual(log?.body, {
        total: 7,
        eligible: 1,
        suggested: 2,
        skipped: 3,
      });
    });
  });

  describe('suggested matches', () => {
    it('describes a candidate completely, omitting absent optional fields', async () => {
      const preview = await previewReducedManifest(
        v2([evidenceItem(893, input.message)]),
        adminId,
      );
      const candidate = {
        requestId: String(supportRequest._id),
        category: 'other',
        submittedAt: sent.toISOString(),
        matchKind: 'suggested',
        reason: SUGGESTION_REASON,
        email: input.email,
        timeDifferenceSeconds: 0,
        competingCandidateCount: 1,
        currentStatus: 'open',
        importedStatus: 'pending',
      };
      assert.deepEqual(preview.matchReviews, [
        {
          zendeskTicketId: 893,
          category: 'other',
          submittedAt: sent.toISOString(),
          importedStatus: 'pending',
          candidates: [candidate],
        },
      ]);
      assert.deepEqual(preview.counts, {
        total: 1,
        eligible: 0,
        suggested: 1,
        alreadyApplied: 0,
        skipped: 0,
        skippedByReason: {},
      });

      await SupportRequest.updateOne(
        { _id: supportRequest._id },
        { $set: { username: 'fictional-name', subject: 'Fictional subject' } },
      );
      const withDetails = await previewReducedManifest(
        v2([evidenceItem(893, input.message)]),
        adminId,
      );
      assert.deepEqual(withDetails.matchReviews[0]?.candidates, [
        {
          ...candidate,
          senderUsername: 'fictional-name',
          subject: 'Fictional subject',
        },
      ]);
    });

    it('stores the evidence and a snapshot of each suggested candidate', async () => {
      const statusChangedAt = new Date('2024-02-01T00:00:00.000Z');
      const lastActivityAt = new Date('2024-03-01T00:00:00.000Z');
      await SupportRequest.updateOne(
        { _id: supportRequest._id },
        { $set: { statusChangedAt, lastActivityAt, statusRevision: 4 } },
      );
      const preview = await previewReducedManifest(
        v2([evidenceItem(893, input.message)]),
        adminId,
      );
      const [entry] = (await stored(preview.previewId)).entries;
      assert.equal(entry?.state, 'suggested');
      assert.equal(entry?.matchKind, 'suggested');
      assert.equal(entry?.reason, undefined);
      assert.equal(entry?.senderHash, supportImportSenderHash(input.email));
      assert.equal(entry?.category, 'other');
      assert.equal(entry?.submittedAt?.getTime(), sent.getTime());
      assert.equal(
        entry?.normalisedMessageHash,
        supportImportMessageHash(input.message),
      );
      assert.equal(entry?.competingCandidateCount, 1);
      assert.equal(
        entry?.originalFingerprint,
        supportRequestFingerprint(input),
      );
      assert.equal(entry?.currentStatus, 'open');
      assert.equal(entry?.statusRevision, 4);
      assert.equal(
        entry?.statusChangedAt?.getTime(),
        statusChangedAt.getTime(),
      );
      assert.equal(entry?.lastActivityAt?.getTime(), lastActivityAt.getTime());
      assert.equal(entry?.sent?.getTime(), sent.getTime());
      assert.equal(entry?.currentTicketId, null);
    });

    it('keeps the matching window inclusive and reports whole seconds', async () => {
      const atWindow = await previewReducedManifest(
        v2([evidenceItem(1, input.message, new Date(sent.getTime() - MINUTE))]),
        adminId,
      );
      assert.equal(atWindow.counts.suggested, 1);
      assert.equal(
        atWindow.matchReviews[0]?.candidates[0]?.timeDifferenceSeconds,
        60,
      );

      const beyond = await previewReducedManifest(
        v2([
          evidenceItem(2, input.message, new Date(sent.getTime() - MINUTE - 1)),
        ]),
        adminId,
      );
      assert.equal(beyond.counts.suggested, 0);

      const wide = await previewReducedManifest(
        v2([
          evidenceItem(3, input.message, new Date(sent.getTime() + 125_500)),
        ]),
        adminId,
        '5',
      );
      assert.equal(
        wide.matchReviews[0]?.candidates[0]?.timeDifferenceSeconds,
        125,
      );
    });

    it('only suggests requests that are free to take the ticket', async () => {
      await SupportRequest.updateOne(
        { _id: supportRequest._id },
        { $set: { zendeskTicketId: 111 } },
      );
      const otherTicket = await previewReducedManifest(
        v2([evidenceItem(5, input.message)]),
        adminId,
      );
      assert.equal(otherTicket.counts.suggested, 0);
      assert.equal(otherTicket.counts.skippedByReason['no-match'], 1);

      await SupportRequest.collection.updateOne(
        { _id: supportRequest._id },
        { $set: { zendeskTicketId: null } },
      );
      const explicitNull = await previewReducedManifest(
        v2([evidenceItem(5, input.message)]),
        adminId,
      );
      assert.equal(explicitNull.counts.suggested, 1);
    });

    it('does not suggest a request that another item already matches exactly', async () => {
      const preview = await previewReducedManifest(
        v2([
          item({ evidence: evidence(input.message, null) }),
          evidenceItem(790, input.message),
        ]),
        adminId,
      );
      assert.equal(preview.counts.eligible, 1);
      assert.equal(preview.counts.suggested, 0);
      assert.equal(preview.counts.skippedByReason['no-match'], 1);
      assert.deepEqual(
        (await stored(preview.previewId)).entries.map(entry => [
          entry.zendeskTicketId,
          entry.state,
          entry.reason,
        ]),
        [
          [789, 'ready', undefined],
          [790, 'skipped', 'no-match'],
        ],
      );
    });

    it('lets two items suggest the same request but never accepts it twice', async () => {
      const preview = await previewReducedManifest(
        v2([
          evidenceItem(801, input.message),
          evidenceItem(802, input.message),
        ]),
        adminId,
      );
      assert.equal(preview.counts.suggested, 2);
      const requestId = String(supportRequest._id);
      await assert.rejects(
        applyPreview(preview.previewId, adminId, [
          { zendeskTicketId: 801, requestId },
          { zendeskTicketId: 802, requestId },
        ]),
        ONE_TO_ONE,
      );
      assert.equal((await storedRequest()).status, 'open');
    });
  });

  /** One of every outcome, with enough distinct counts to tell them apart. */
  async function mixedScenario() {
    const alreadyApplied = await createRequest('Request one', {
      status: 'pending',
      zendeskTicketId: 701,
    });
    const ready = await createRequest('Request two');
    const suggestedA = await createRequest('Request three');
    const suggestedB = await createRequest('Request four');
    const conflicted = await createRequest('Request five', {
      zendeskTicketId: 999,
    });
    const own = (request: SupportRequestFixture, ticket: number) =>
      item({
        zendeskTicketId: ticket,
        fingerprint: supportRequestFingerprint({
          ...input,
          message: request.message,
        }),
        evidence: evidence(request.message, null),
      });
    return {
      alreadyApplied,
      ready,
      suggestedA,
      suggestedB,
      conflicted,
      manifest: v2([
        own(alreadyApplied, 701),
        own(ready, 702),
        evidenceItem(703, suggestedA.message),
        evidenceItem(704, suggestedB.message),
        own(conflicted, 705),
        evidenceItem(706, 'Nothing like this exists', null),
        evidenceItem(707, 'Nothing like this exists either', null),
      ]),
    };
  }

  describe('apply', () => {
    it('applies the exact matches, leaves unresolved suggestions and reports every outcome', async () => {
      const scenario = await mixedScenario();
      const preview = await previewReducedManifest(scenario.manifest, adminId);
      assert.deepEqual(preview.counts, {
        total: 7,
        eligible: 1,
        suggested: 2,
        alreadyApplied: 1,
        skipped: 3,
        skippedByReason: { 'ticket-id-conflict': 1, 'no-match': 2 },
      });
      assert.deepEqual(
        (await stored(preview.previewId)).entries.map(entry => [
          entry.zendeskTicketId,
          entry.state,
          entry.reason,
        ]),
        [
          [701, 'alreadyApplied', undefined],
          [702, 'ready', undefined],
          [703, 'suggested', undefined],
          [704, 'suggested', undefined],
          [705, 'skipped', 'ticket-id-conflict'],
          [706, 'skipped', 'no-match'],
          [707, 'skipped', 'no-match'],
        ],
      );
      const result = await applyPreview(preview.previewId, adminId);
      assert.deepEqual(result, { applied: 1, alreadyApplied: 1, skipped: 5 });
      const log = await auditFor('support-status-import/apply');
      assert.equal(String(log?.user), String(adminId));
      assert.deepEqual(log?.params, { previewId: preview.previewId });
      assert.deepEqual(log?.body, { eligible: 1, selectedSuggestions: 0 });
      assert.equal(
        (await storedRequest(scenario.ready._id)).zendeskTicketId,
        702,
      );
      assert.equal(
        (await storedRequest(scenario.suggestedA._id)).status,
        'open',
      );
    });

    it('applies a selected suggestion next to the exact matches', async () => {
      const scenario = await mixedScenario();
      const preview = await previewReducedManifest(scenario.manifest, adminId);
      const result = await applyPreview(preview.previewId, adminId, [
        { zendeskTicketId: 703, requestId: String(scenario.suggestedA._id) },
      ]);
      assert.deepEqual(result, { applied: 2, alreadyApplied: 1, skipped: 4 });
      const log = await auditFor('support-status-import/apply');
      assert.deepEqual(log?.body, { eligible: 2, selectedSuggestions: 1 });
      const updated = await storedRequest(scenario.suggestedA._id);
      assert.equal(updated.status, 'pending');
      assert.equal(updated.zendeskTicketId, 703);
      assert.equal(
        (await storedRequest(scenario.suggestedB._id)).zendeskTicketId,
        undefined,
      );
      assert.deepEqual((await stored(preview.previewId)).result, result);
    });

    it('rejects selections that overlap exact matches or are not suggestions', async () => {
      const scenario = await mixedScenario();
      const preview = await previewReducedManifest(scenario.manifest, adminId);
      const id = (request: SupportRequestFixture) => String(request._id);
      const rejected: Array<
        [string, number, string, { status: number; message: string }]
      > = [
        [
          'ticket of an already applied match',
          701,
          id(scenario.suggestedA),
          ONE_TO_ONE,
        ],
        ['ticket of a ready match', 702, id(scenario.suggestedA), ONE_TO_ONE],
        [
          'request of an already applied match',
          703,
          id(scenario.alreadyApplied),
          ONE_TO_ONE,
        ],
        ['request of a ready match', 703, id(scenario.ready), ONE_TO_ONE],
        [
          'a ticket without suggestions',
          999_999,
          id(scenario.suggestedA),
          NOT_SUGGESTED,
        ],
        [
          'another ticket’s candidate',
          703,
          id(scenario.suggestedB),
          NOT_SUGGESTED,
        ],
        [
          'an unrelated request',
          703,
          String(new mongoose.Types.ObjectId()),
          NOT_SUGGESTED,
        ],
        [
          'a skipped entry that names a request',
          705,
          id(scenario.conflicted),
          NOT_SUGGESTED,
        ],
      ];
      for (const [label, zendeskTicketId, requestId, expected] of rejected) {
        await assert.rejects(
          applyPreview(preview.previewId, adminId, [
            { zendeskTicketId, requestId },
          ]),
          expected,
          label,
        );
      }
      // Rejected selections never claim the preview.
      assert.equal((await stored(preview.previewId)).result, undefined);
      assert.equal(
        ((await stored(preview.previewId)) as { applyToken?: string })
          .applyToken,
        undefined,
      );
    });

    it('rejects a ticket or a request selected twice', async () => {
      const scenario = await mixedScenario();
      const preview = await previewReducedManifest(scenario.manifest, adminId);
      const a = String(scenario.suggestedA._id);
      const b = String(scenario.suggestedB._id);
      await assert.rejects(
        applyPreview(preview.previewId, adminId, [
          { zendeskTicketId: 703, requestId: a },
          { zendeskTicketId: 703, requestId: b },
        ]),
        ONE_TO_ONE,
      );
      await assert.rejects(
        applyPreview(preview.previewId, adminId, [
          { zendeskTicketId: 703, requestId: a },
          { zendeskTicketId: 704, requestId: a },
        ]),
        ONE_TO_ONE,
      );
    });

    it('rejects malformed selections and previews', async () => {
      const preview = await previewReducedManifest(v1(), adminId);
      const requestId = String(new mongoose.Types.ObjectId());
      const valid = { zendeskTicketId: 5, requestId };
      const selections: Array<[string, unknown]> = [
        ['a non-array', {}],
        ['a string', 'selection'],
        ['a null selection', [null]],
        ['a string selection', ['selection']],
        ['an extra key', [{ ...valid, extra: 1 }]],
        ['a missing key', [{ requestId }]],
        ['a string ticket id', [{ ...valid, zendeskTicketId: '5' }]],
        ['a fractional ticket id', [{ ...valid, zendeskTicketId: 5.5 }]],
        ['a numeric request id', [{ ...valid, requestId: 5 }]],
        ['an array request id', [{ ...valid, requestId: [requestId] }]],
        ['a prefixed request id', [{ ...valid, requestId: `x${requestId}` }]],
        ['a suffixed request id', [{ ...valid, requestId: `${requestId}x` }]],
        ['a short request id', [{ ...valid, requestId: requestId.slice(1) }]],
      ];
      for (const [label, selection] of selections) {
        await assert.rejects(
          applyPreview(preview.previewId, adminId, selection as never),
          SELECTION_ERROR,
          label,
        );
      }
      const INVALID_PREVIEW = {
        status: 400,
        message: 'Invalid support status preview.',
      };
      for (const bad of [
        `x${preview.previewId}`,
        `${preview.previewId}x`,
        preview.previewId.slice(1),
        '',
      ]) {
        await assert.rejects(applyPreview(bad, adminId), INVALID_PREVIEW, bad);
      }
      await assert.rejects(
        applyPreview(String(new mongoose.Types.ObjectId()), adminId),
        { status: 404, message: 'Support status preview not found.' },
      );
    });

    it('answers a replayed apply with the saved result, whatever is sent with it', async () => {
      const preview = await previewReducedManifest(v1(), adminId);
      const first = await applyPreview(preview.previewId, adminId);
      assert.deepEqual(
        await applyPreview(preview.previewId, adminId, [
          { bad: true },
        ] as never),
        first,
      );
      assert.equal((await storedRequest()).statusRevision, 1);
    });

    it('rejects an expired preview at the exact expiry time', async () => {
      const preview = await previewReducedManifest(v1(), adminId);
      const expiresAt = new Date('2030-01-01T00:00:00.000Z');
      await PreviewModel.updateOne(
        { _id: preview.previewId },
        { $set: { expiresAt } },
      );
      const clock = sinon.useFakeTimers({ now: expiresAt, toFake: ['Date'] });
      try {
        await assert.rejects(applyPreview(preview.previewId, adminId), {
          status: 410,
          message: 'Support status preview has expired.',
        });
      } finally {
        clock.restore();
      }
    });

    it('reports every stored outcome of a preview with only skipped entries', async () => {
      const duplicateTickets = await previewReducedManifest(
        v1({}, { items: [item(), item({ status: 'solved' })] }),
        adminId,
      );
      const duplicateFingerprints = await previewReducedManifest(
        v1({}, { items: [item(), item({ zendeskTicketId: 790 })] }),
        adminId,
      );
      const noMatch = await previewReducedManifest(
        v1({ fingerprint: 'f'.repeat(64) }),
        adminId,
      );
      await createRequest(input.message, { sent: new Date('2024-01-02') });
      const ambiguous = await previewReducedManifest(v1(), adminId);
      const cases: Array<[string, typeof noMatch, string, number]> = [
        ['duplicate ticket ids', duplicateTickets, 'duplicate-ticket-id', 2],
        [
          'duplicate fingerprints',
          duplicateFingerprints,
          'duplicate-fingerprint',
          2,
        ],
        ['no match', noMatch, 'no-match', 1],
        ['an ambiguous match', ambiguous, 'ambiguous-match', 1],
      ];
      for (const [label, preview, reason, count] of cases) {
        const { entries } = await stored(preview.previewId);
        assert.equal(entries.length, count, label);
        assert.ok(
          entries.every(
            entry => entry.state === 'skipped' && entry.reason === reason,
          ),
          label,
        );
        assert.deepEqual(
          await applyPreview(preview.previewId, adminId),
          { applied: 0, alreadyApplied: 0, skipped: count },
          label,
        );
      }
    });

    it('stores the request with every skip that matched one', async () => {
      // A request holding another ticket, and a ticket held by another request.
      await SupportRequest.updateOne(
        { _id: supportRequest._id },
        { $set: { zendeskTicketId: 123 } },
      );
      const heldByRequest = await previewReducedManifest(v1(), adminId);
      await SupportRequest.updateOne(
        { _id: supportRequest._id },
        { $unset: { zendeskTicketId: '' } },
      );
      await createRequest('Another request', { zendeskTicketId: 789 });
      const heldByOther = await previewReducedManifest(v1(), adminId);
      await SupportRequest.updateOne(
        { _id: supportRequest._id },
        { $set: { lastActivityAt: new Date('2026-01-01') } },
      );
      await SupportRequest.deleteMany({ _id: { $ne: supportRequest._id } });
      const newer = await previewReducedManifest(v1(), adminId);

      for (const [preview, reason] of [
        [heldByRequest, 'ticket-id-conflict'],
        [heldByOther, 'ticket-id-conflict'],
        [newer, 'newer-local-activity'],
      ] as const) {
        const { entries } = await stored(preview.previewId);
        assert.equal(entries.length, 1, reason);
        assert.equal(entries[0]?.state, 'skipped');
        assert.equal(entries[0]?.reason, reason);
        assert.equal(String(entries[0]?.requestId), String(supportRequest._id));
        assert.deepEqual(await applyPreview(preview.previewId, adminId), {
          applied: 0,
          alreadyApplied: 0,
          skipped: 1,
        });
      }
    });

    it('stores skipped entries for sources that target one request twice', async () => {
      const message = 'Please help with a & b.';
      await SupportRequest.updateOne(
        { _id: supportRequest._id },
        { $set: { message } },
      );
      const preview = await previewReducedManifest(
        v1(
          {},
          {
            items: [
              item({
                fingerprint: supportRequestFingerprint({ ...input, message }),
              }),
              item({
                zendeskTicketId: 790,
                fingerprint: supportRequestFingerprint({
                  ...input,
                  message: 'Please help with a &amp; b.',
                }),
              }),
            ],
          },
        ),
        adminId,
      );
      const { entries } = await stored(preview.previewId);
      assert.deepEqual(
        entries.map(entry => [entry.state, entry.reason]),
        [
          ['skipped', 'ambiguous-source-match'],
          ['skipped', 'ambiguous-source-match'],
        ],
      );
      assert.deepEqual(await applyPreview(preview.previewId, adminId), {
        applied: 0,
        alreadyApplied: 0,
        skipped: 2,
      });
    });

    it('counts a request that already has the imported state when applying', async () => {
      await SupportRequest.updateOne(
        { _id: supportRequest._id },
        { $set: { status: 'pending', zendeskTicketId: 789 } },
      );
      const preview = await previewReducedManifest(v1(), adminId);
      const [entry] = (await stored(preview.previewId)).entries;
      assert.equal(entry?.state, 'alreadyApplied');
      assert.deepEqual(await applyPreview(preview.previewId, adminId), {
        applied: 0,
        alreadyApplied: 1,
        skipped: 0,
      });
    });

    it('applies requests whose every snapshot field is set', async () => {
      const statusChangedAt = new Date('2024-02-01T00:00:00.000Z');
      const lastActivityAt = new Date('2024-03-01T00:00:00.000Z');
      await SupportRequest.deleteMany({});
      const request = await SupportRequest.create({
        ...input,
        category: 'reportMember',
        reportMember: 'fictional-target',
        status: 'open',
        statusRevision: 3,
        statusChangedAt,
        lastActivityAt,
        zendeskTicketId: 789,
        sent,
      });
      const preview = await previewReducedManifest(
        v1(
          {},
          {
            items: [
              item({
                fingerprint: supportRequestFingerprint({
                  ...input,
                  category: 'reportMember',
                }),
              }),
            ],
          },
        ),
        adminId,
      );
      const [entry] = (await stored(preview.previewId)).entries;
      assert.equal(entry?.currentStatus, 'open');
      assert.equal(entry?.statusRevision, 3);
      assert.equal(
        entry?.statusChangedAt?.getTime(),
        statusChangedAt.getTime(),
      );
      assert.equal(entry?.lastActivityAt?.getTime(), lastActivityAt.getTime());
      assert.equal(entry?.sent?.getTime(), sent.getTime());
      assert.equal(entry?.currentTicketId, 789);
      assert.deepEqual(await applyPreview(preview.previewId, adminId), {
        applied: 1,
        alreadyApplied: 0,
        skipped: 0,
      });
      const updated = await storedRequest(request._id);
      assert.equal(updated.status, 'pending');
      assert.equal(updated.statusRevision, 4);
      assert.equal(updated.zendeskTicketId, 789);
      assert.equal(updated.reportMember, 'fictional-target');
      assert.ok(updated.statusChangedAt! > statusChangedAt);
      assert.equal(updated.lastActivityAt?.getTime(), lastActivityAt.getTime());
    });

    it('applies a legacy request that has no revision yet', async () => {
      await SupportRequest.collection.updateOne(
        { _id: supportRequest._id },
        { $unset: { statusRevision: '' } },
      );
      const preview = await previewReducedManifest(v1(), adminId);
      assert.deepEqual(await applyPreview(preview.previewId, adminId), {
        applied: 1,
        alreadyApplied: 0,
        skipped: 0,
      });
      assert.equal((await storedRequest()).statusRevision, 1);
    });

    it('sets the resolution time only for solved and closed statuses', async () => {
      for (const [status, resolved] of [
        ['solved', true],
        ['closed', true],
        ['pending', false],
        ['open', false],
      ] as const) {
        await SupportRequest.updateOne(
          { _id: supportRequest._id },
          {
            $set: { status: status === 'open' ? 'new' : 'open' },
            $unset: { zendeskTicketId: '', statusChangedAt: '' },
          },
        );
        const preview = await previewReducedManifest(v1({ status }), adminId);
        await applyPreview(preview.previewId, adminId);
        const updated = await storedRequest();
        assert.equal(updated.status, status);
        assert.equal(
          updated.resolvedAt?.toISOString() ?? null,
          resolved ? UPDATED_AT : null,
          status,
        );
      }
    });

    it('never writes when the request changed after the preview', async () => {
      const changes: Array<[string, Record<string, unknown>]> = [
        ['status', { status: 'solved' }],
        ['statusRevision', { statusRevision: 4 }],
        ['statusChangedAt', { statusChangedAt: new Date('2024-06-01') }],
        ['lastActivityAt', { lastActivityAt: new Date('2024-06-01') }],
        ['sent', { sent: new Date('2024-06-01') }],
        ['zendeskTicketId', { zendeskTicketId: 555 }],
      ];
      for (const [field, change] of changes) {
        sinon.restore();
        await SupportRequest.deleteMany({});
        const request = await createRequest(input.message, {
          statusChangedAt: new Date('2024-02-01'),
        });
        const preview = await previewReducedManifest(v1(), adminId);
        await SupportRequest.collection.updateOne(
          { _id: request._id },
          { $set: change },
        );
        const updateOne = sinon.spy(SupportRequest, 'updateOne');
        assert.deepEqual(
          await applyPreview(preview.previewId, adminId),
          { applied: 0, alreadyApplied: 0, skipped: 1 },
          field,
        );
        assert.equal(updateOne.called, false, field);
      }
    });

    it('rejects a concurrent change to any snapshot field at write time', async () => {
      const original = {
        status: 'open',
        statusRevision: 2,
        statusChangedAt: new Date('2024-02-01'),
        lastActivityAt: new Date('2024-03-01'),
        zendeskTicketId: 789,
      };
      const changes: Array<[string, Record<string, unknown>]> = [
        ['status', { $set: { status: 'solved' } }],
        ['statusRevision', { $set: { statusRevision: 9 } }],
        [
          'statusChangedAt',
          { $set: { statusChangedAt: new Date('2024-06-01') } },
        ],
        ['statusChangedAt removed', { $unset: { statusChangedAt: '' } }],
        [
          'lastActivityAt',
          { $set: { lastActivityAt: new Date('2024-06-01') } },
        ],
        ['lastActivityAt removed', { $unset: { lastActivityAt: '' } }],
        ['sent', { $set: { sent: new Date('2024-06-01') } }],
        ['zendeskTicketId removed', { $unset: { zendeskTicketId: '' } }],
      ];
      for (const [label, change] of changes) {
        sinon.restore();
        await SupportRequest.deleteMany({});
        const request = await createRequest(input.message, original);
        const preview = await previewReducedManifest(v1(), adminId);
        const realUpdateOne = SupportRequest.updateOne.bind(SupportRequest);
        sinon.stub(SupportRequest, 'updateOne').callsFake((async (
          ...args: Parameters<typeof SupportRequest.updateOne>
        ) => {
          await SupportRequest.collection.updateOne(
            { _id: request._id },
            change,
          );
          return realUpdateOne(...args);
        }) as never);
        assert.deepEqual(
          await applyPreview(preview.previewId, adminId),
          { applied: 0, alreadyApplied: 0, skipped: 1 },
          label,
        );
      }
      // Fields that were empty at preview time stay guarded as empty.
      for (const [label, change] of [
        ['lastActivityAt', { lastActivityAt: new Date('2024-06-01') }],
        ['statusChangedAt', { statusChangedAt: new Date('2024-06-01') }],
        ['zendeskTicketId', { zendeskTicketId: 555 }],
      ] as const) {
        sinon.restore();
        await SupportRequest.deleteMany({});
        const request = await createRequest(input.message);
        const preview = await previewReducedManifest(v1(), adminId);
        const realUpdateOne = SupportRequest.updateOne.bind(SupportRequest);
        sinon.stub(SupportRequest, 'updateOne').callsFake((async (
          ...args: Parameters<typeof SupportRequest.updateOne>
        ) => {
          await SupportRequest.collection.updateOne(
            { _id: request._id },
            { $set: change },
          );
          return realUpdateOne(...args);
        }) as never);
        assert.deepEqual(
          await applyPreview(preview.previewId, adminId),
          { applied: 0, alreadyApplied: 0, skipped: 1 },
          label,
        );
      }
    });

    it('keeps the reported member in the write guard', async () => {
      await SupportRequest.deleteMany({});
      await SupportRequest.create({
        ...input,
        category: 'reportMember',
        reportMember: 'fictional-target',
        status: 'open',
        sent,
      });
      const preview = await previewReducedManifest(
        v1(
          {},
          {
            items: [
              item({
                fingerprint: supportRequestFingerprint({
                  ...input,
                  category: 'reportMember',
                }),
              }),
            ],
          },
        ),
        adminId,
      );
      assert.deepEqual(await applyPreview(preview.previewId, adminId), {
        applied: 1,
        alreadyApplied: 0,
        skipped: 0,
      });
    });

    describe('suggested matches are rechecked at apply time', () => {
      async function suggested(itemSent: Date = sent, window?: string) {
        const preview = await previewReducedManifest(
          v2([evidenceItem(893, input.message, itemSent)]),
          adminId,
          window,
        );
        assert.equal(preview.counts.suggested, 1);
        return preview;
      }
      const select = (preview: { previewId: string }) =>
        applyPreview(preview.previewId, adminId, [
          { zendeskTicketId: 893, requestId: String(supportRequest._id) },
        ]);
      const skippedOnce = { applied: 0, alreadyApplied: 0, skipped: 1 };

      it('skips when any stored piece of evidence is missing or differs', async () => {
        const tampering: Array<[string, Record<string, unknown>]> = [
          ['no senderHash', { $unset: { 'entries.0.senderHash': '' } }],
          ['no category', { $unset: { 'entries.0.category': '' } }],
          [
            'no normalisedMessageHash',
            { $unset: { 'entries.0.normalisedMessageHash': '' } },
          ],
          ['no submittedAt', { $unset: { 'entries.0.submittedAt': '' } }],
          [
            'another senderHash',
            { $set: { 'entries.0.senderHash': 'f'.repeat(64) } },
          ],
          ['another category', { $set: { 'entries.0.category': 'account' } }],
          [
            'another message hash',
            { $set: { 'entries.0.normalisedMessageHash': 'e'.repeat(64) } },
          ],
          [
            'a submission time outside the window',
            {
              $set: {
                'entries.0.submittedAt': new Date(sent.getTime() - MINUTE - 1),
              },
            },
          ],
        ];
        for (const [label, update] of tampering) {
          sinon.restore();
          const preview = await suggested();
          await PreviewModel.updateOne({ _id: preview.previewId }, update);
          assert.deepEqual(await select(preview), skippedOnce, label);
          const unchanged = await storedRequest();
          assert.equal(unchanged.status, 'open', label);
          assert.equal(unchanged.zendeskTicketId, undefined, label);
        }
      });

      it('applies a submission time exactly at the window and skips one just beyond', async () => {
        const atWindow = await suggested(new Date(sent.getTime() + MINUTE));
        assert.deepEqual(await select(atWindow), {
          applied: 1,
          alreadyApplied: 0,
          skipped: 0,
        });
        await SupportRequest.updateOne(
          { _id: supportRequest._id },
          { $set: { status: 'open' }, $unset: { zendeskTicketId: '' } },
        );
        const beyond = await suggested(new Date(sent.getTime() + MINUTE));
        await PreviewModel.updateOne(
          { _id: beyond.previewId },
          {
            $set: {
              'entries.0.submittedAt': new Date(sent.getTime() + MINUTE + 1),
            },
          },
        );
        assert.deepEqual(await select(beyond), skippedOnce);
      });

      it('enforces the stored window, and one minute for legacy previews', async () => {
        const wide = await suggested(
          new Date(sent.getTime() - 2 * MINUTE),
          '5',
        );
        await PreviewModel.updateOne(
          { _id: wide.previewId },
          { $set: { matchingWindowMinutes: 1 } },
        );
        assert.deepEqual(await select(wide), skippedOnce);

        const legacy = await suggested(
          new Date(sent.getTime() - 2 * MINUTE),
          '5',
        );
        await PreviewModel.updateOne(
          { _id: legacy.previewId },
          { $unset: { matchingWindowMinutes: 1 } },
        );
        assert.deepEqual(await select(legacy), skippedOnce);

        const intact = await suggested(
          new Date(sent.getTime() - 2 * MINUTE),
          '5',
        );
        assert.equal((await stored(intact.previewId)).matchingWindowMinutes, 5);
        assert.deepEqual(await select(intact), {
          applied: 1,
          alreadyApplied: 0,
          skipped: 0,
        });
      });
    });

    describe('failures', () => {
      it('never leaks the detail of a storage failure, whatever its status', async () => {
        for (const status of [500, 503, undefined]) {
          sinon.restore();
          const preview = await previewReducedManifest(v1(), adminId);
          sinon
            .stub(AuditLog.prototype, 'save')
            .rejects(Object.assign(new Error('private detail'), { status }));
          await assert.rejects(applyPreview(preview.previewId, adminId), {
            status: 500,
            message: 'Unable to apply support status import.',
          });
        }
      });

      it('releases only its own claim after a failure', async () => {
        const other = await previewReducedManifest(v1(), adminId);
        await PreviewModel.updateOne(
          { _id: other.previewId },
          { $set: { applyToken: 'another-apply' } },
        );
        const own = await previewReducedManifest(v1(), adminId);
        sinon
          .stub(AuditLog.prototype, 'save')
          .rejects(new Error('private detail'));
        await assert.rejects(applyPreview(own.previewId, adminId), {
          status: 500,
        });
        assert.equal(
          ((await stored(other.previewId)) as { applyToken?: string })
            .applyToken,
          'another-apply',
        );
        assert.equal(
          ((await stored(own.previewId)) as { applyToken?: string }).applyToken,
          undefined,
        );
      });

      it('completes and releases only its own preview', async () => {
        const other = await previewReducedManifest(v1(), adminId);
        const own = await previewReducedManifest(v1(), adminId);
        const result = await applyPreview(own.previewId, adminId);
        assert.deepEqual(result, { applied: 1, alreadyApplied: 0, skipped: 0 });
        const done = (await stored(own.previewId)) as {
          applyToken?: string;
          appliedAt?: Date;
          result?: unknown;
        };
        assert.deepEqual(done.result, result);
        assert.equal(done.applyToken, undefined);
        assert.ok(done.appliedAt instanceof Date);
        const untouched = (await stored(other.previewId)) as {
          applyToken?: string;
          appliedAt?: Date;
          result?: unknown;
        };
        assert.equal(untouched.result, undefined);
        assert.equal(untouched.appliedAt, undefined);
        assert.equal(untouched.applyToken, undefined);
      });

      it('does not hand out another preview’s result when the claim is lost', async () => {
        const finished = await previewReducedManifest(v1(), adminId);
        const busy = await previewReducedManifest(v1(), adminId);
        await applyPreview(finished.previewId, adminId);
        await PreviewModel.updateOne(
          { _id: busy.previewId },
          { $set: { applyToken: 'another-apply' } },
        );
        await assert.rejects(applyPreview(busy.previewId, adminId), {
          status: 409,
          message: 'Support status preview is already being applied.',
        });
      });

      it('reports a conflict when the preview disappears while its claim is lost', async () => {
        const preview = await previewReducedManifest(v1(), adminId);
        let reads = 0;
        const originalFindOne = PreviewModel.findOne.bind(PreviewModel);
        sinon.stub(PreviewModel, 'findOne').callsFake(((...args: unknown[]) => {
          reads++;
          if (reads === 2) return { lean: async () => null } as never;
          return originalFindOne(
            ...(args as Parameters<typeof PreviewModel.findOne>),
          );
        }) as never);
        sinon.stub(PreviewModel, 'findOneAndUpdate').returns({
          lean: async () => null,
        } as never);
        await assert.rejects(applyPreview(preview.previewId, adminId), {
          status: 409,
          message: 'Support status preview is already being applied.',
        });
      });
    });
  });
});
