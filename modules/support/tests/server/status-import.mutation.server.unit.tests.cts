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

type Rec = Record<string, unknown>;

const SupportRequest = mongoose.model<SupportRequestFixture>('SupportRequest');
const AuditLog = mongoose.model<AuditFixture>('AuditLog');
const User = mongoose.model('User');
const PreviewModel = mongoose.model<SupportStatusImportPreviewRecord>(
  'SupportStatusImportPreview',
);

const badRequest = (message: string) => ({ status: 400, message });
const MANIFEST_ERROR = badRequest('Invalid support status manifest.');
const ONE_TO_ONE = badRequest('Support status selections must be one-to-one.');
const NOT_SUGGESTED = badRequest(
  'Selected support request is not a suggested match.',
);
const CLAIM_LOST = {
  status: 409,
  message: 'Support status preview is already being applied.',
};
const SUGGESTION_REASON =
  'same sender, same category, submitted within the selected window, equivalent message after formatting normalisation';
const HEX64 = 'a'.repeat(64);
const UPDATED_AT = '2025-01-01T00:00:00.000Z';
const EXPORTED_AT = '2025-06-01T00:00:00.000Z';
const MINUTE = 60_000;
const CHANGED_AT = new Date('2024-02-01T00:00:00.000Z');
const ACTIVITY_AT = new Date('2024-03-01T00:00:00.000Z');
const LATER = new Date('2024-06-01');

const outcome = (applied: number, alreadyApplied: number, skipped: number) => ({
  applied,
  alreadyApplied,
  skipped,
});
const counts = (
  [total, eligible, suggested, alreadyApplied, skipped]: number[],
  skippedByReason: Rec = {},
) => ({ total, eligible, suggested, alreadyApplied, skipped, skippedByReason });
const set = (field: string, value: unknown) => ({ $set: { [field]: value } });
const unset = (field: string) => ({ $unset: { [field]: '' } });

describe('conservative support status import: behaviour guards', () => {
  let adminId: Types.ObjectId;
  let supportRequest: SupportRequestFixture;
  const input = {
    category: 'other' as const,
    email: 'visitor@example.org',
    message: 'A fictional request for help.',
  };
  const sent = new Date('2024-01-01T00:00:00.000Z');
  const at = (offset: number) => new Date(sent.getTime() + offset);
  const fingerprint = (fields: Rec) =>
    supportRequestFingerprint({ ...input, ...fields });

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

  const item = (overrides: Rec = {}) => ({
    zendeskTicketId: 789,
    status: 'pending',
    updatedAt: UPDATED_AT,
    fingerprint: supportRequestFingerprint(input),
    ...overrides,
  });
  const v1 = (itemOverrides: Rec = {}, overrides: Rec = {}) => ({
    version: 1,
    exportedAt: EXPORTED_AT,
    items: [item(itemOverrides)],
    ...overrides,
  });
  const v1Items = (...items: unknown[]) => v1({}, { items });
  const v2 = (items: unknown[], overrides: Rec = {}) => ({
    version: 2,
    exportedAt: EXPORTED_AT,
    items,
    ...overrides,
  });

  const evidence = (message: string, submittedAt: Date | null = sent) => ({
    senderHash: supportImportSenderHash(input.email),
    category: 'other',
    submittedAt: submittedAt === null ? null : submittedAt.toISOString(),
    normalisedMessageHash: supportImportMessageHash(message),
  });

  /** A v2 item whose fingerprint matches nothing, so only evidence can match it. */
  const evidenceItem = (
    zendeskTicketId: number,
    message: string,
    submittedAt: Date | null = sent,
  ) =>
    item({
      zendeskTicketId,
      fingerprint: fingerprint({
        message: `Source text of ticket ${zendeskTicketId}.`,
      }),
      evidence: evidence(message, submittedAt),
    });

  /** A v2 manifest whose one item only the fixture request can match, by evidence. */
  const suggestion = (ticket = 893, submittedAt: Date | null = sent) =>
    v2([evidenceItem(ticket, input.message, submittedAt)]);

  const preview = (source: unknown, window?: string) =>
    previewReducedManifest(source, adminId, window);
  const apply = (target: { previewId: string }, selections?: unknown) =>
    applyPreview(target.previewId, adminId, selections as never);
  const tamper = (target: { previewId: string }, change: object) =>
    PreviewModel.updateOne({ _id: target.previewId }, change);

  async function stored(previewId: string) {
    return (await PreviewModel.findById(previewId).lean())!;
  }

  async function storedMeta(previewId: string) {
    return (await stored(previewId)) as {
      applyToken?: string;
      appliedAt?: Date;
      result?: unknown;
    };
  }

  async function storedRequest(id: Types.ObjectId = supportRequest._id) {
    return (await SupportRequest.findById(id).lean())!;
  }

  /** Updates the fixture request through mongoose. */
  const update = (change: Rec) =>
    SupportRequest.updateOne({ _id: supportRequest._id }, change);

  /** Updates the fixture request in the raw collection, bypassing mongoose. */
  const rawUpdate = (change: Rec) =>
    SupportRequest.collection.updateOne({ _id: supportRequest._id }, change);

  const createRequest = (message: string, fields: Rec = {}) =>
    SupportRequest.create({
      ...input,
      message,
      status: 'open',
      sent,
      ...fields,
    });

  const auditFor = (route: string) => AuditLog.findOne({ route }).lean();

  async function entryStates(previewId: string) {
    return (await stored(previewId)).entries.map(entry => [
      entry.zendeskTicketId,
      entry.state,
      entry.reason,
    ]);
  }

  /** The request snapshot a stored entry carries, with dates as epoch ms. */
  async function snapshot(previewId: string) {
    const [entry] = (await stored(previewId)).entries;
    return [
      entry?.currentStatus,
      entry?.statusRevision,
      entry?.statusChangedAt?.getTime(),
      entry?.lastActivityAt?.getTime(),
      entry?.sent?.getTime(),
      entry?.currentTicketId,
    ];
  }

  describe('manifest validation', () => {
    const validEvidence = {
      senderHash: HEX64,
      category: 'other',
      submittedAt: UPDATED_AT,
      normalisedMessageHash: HEX64,
    };
    const v2Item = (evidenceOverrides: Rec = {}) =>
      item({ evidence: { ...validEvidence, ...evidenceOverrides } });
    const ev = (evidenceOverrides: Rec) => v2([v2Item(evidenceOverrides)]);
    const sender = (senderHash: unknown) => ev({ senderHash });
    const msg = (normalisedMessageHash: unknown) =>
      ev({ normalisedMessageHash });
    const wrap = (evidenceValue: unknown) =>
      v2([item({ evidence: evidenceValue })]);

    it('rejects every malformed manifest and v2 evidence with a 400', async () => {
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
        ['a non-object item (number)', v1Items(5)],
        ['a null item', v1Items(null)],
        ['a string item', v1Items('item')],
        [
          'an array item with the right keys',
          v1Items(Object.assign([], item())),
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
        ['null evidence', wrap(null)],
        ['numeric evidence', wrap(5)],
        ['string evidence', wrap('evidence')],
        ['array evidence', wrap(Object.assign([], validEvidence))],
        ['an extra evidence key', wrap({ ...validEvidence, extra: 1 })],
        [
          'a missing evidence key',
          wrap({ senderHash: HEX64, category: 'other', submittedAt: null }),
        ],
        ['a numeric senderHash', sender(5)],
        ['an array senderHash', sender([HEX64])],
        ['a short senderHash', sender('a'.repeat(63))],
        ['a prefixed senderHash', sender(`g${HEX64}`)],
        ['a suffixed senderHash', sender(`${HEX64}g`)],
        ['a numeric normalisedMessageHash', msg(5)],
        ['an array normalisedMessageHash', msg([HEX64])],
        ['a prefixed normalisedMessageHash', msg(`g${HEX64}`)],
        ['a suffixed normalisedMessageHash', msg(`${HEX64}g`)],
        ['an unknown category', ev({ category: 'nonsense' })],
        ['an inherited category', ev({ category: 'toString' })],
        ['an array category', ev({ category: ['other'] })],
        ['a numeric category', ev({ category: 5 })],
        ['an unparseable submittedAt', ev({ submittedAt: 'later' })],
        ['a numeric submittedAt', ev({ submittedAt: 1_735_689_600 })],
        ['an undefined submittedAt', ev({ submittedAt: undefined })],
      ];
      for (const [label, source] of cases) {
        await assert.rejects(preview(source), MANIFEST_ERROR, label);
      }
      assert.equal(await PreviewModel.countDocuments(), 0);
    });

    it('accepts the smallest ticket id, null submission times and the item limit', async () => {
      const smallest = await preview(v1({ zendeskTicketId: 1 }));
      assert.equal(smallest.counts.eligible, 1);
      assert.equal(smallest.changes[0]?.zendeskTicketId, 1);
      const nullTime = await preview(suggestion(5, null));
      assert.equal(nullTime.counts.skippedByReason['no-match'], 1);
      const tickets = Array.from({ length: 10_000 }, (_, index) => index + 1);
      const full = await preview(
        v1Items(...tickets.map(zendeskTicketId => item({ zendeskTicketId }))),
      );
      assert.equal(full.counts.total, 10_000);
    });
  });

  it('answers 403 for unknown users, users without roles and non-admins', async () => {
    const FORBIDDEN = {
      status: 403,
      message: 'An administrator must import support statuses.',
    };
    const stranger = new mongoose.Types.ObjectId();
    await assert.rejects(previewReducedManifest(v1(), stranger), FORBIDDEN);
    const [member] = await utils.saveUsers(
      utils.generateUsersWithSharedPassword(1),
    );
    await assert.rejects(previewReducedManifest(v1(), member!._id), FORBIDDEN);
    await User.collection.updateOne({ _id: member!._id }, unset('roles'));
    await assert.rejects(previewReducedManifest(v1(), member!._id), FORBIDDEN);
    const { previewId } = await preview(v1());
    await assert.rejects(applyPreview(previewId, member!._id), FORBIDDEN);
    await assert.rejects(applyPreview(previewId, stranger), FORBIDDEN);
  });

  describe('preview', () => {
    it('keeps a preview for exactly thirty minutes', async () => {
      // The lifetime is a module constant: import a fresh ESM instance under
      // this test (deleting require.cache does not re-evaluate the .mts module).
      const specifier = `../../server/services/status-import.server.service.mts?ttl=${Date.now()}`;
      const fresh: typeof import('../../server/services/status-import.server.service.mts') =
        await import(specifier);
      const result = await fresh.previewReducedManifest(v1(), adminId);
      const doc = await stored(result.previewId);
      assert.equal(
        doc.expiresAt.getTime() - doc.createdAt.getTime(),
        30 * MINUTE,
      );
      assert.equal(result.expiresAt, doc.expiresAt.toISOString());
    });

    it('describes an exact change completely', async () => {
      const result = await preview(v1());
      assert.deepEqual(result.changes, [
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
      assert.deepEqual(result.matchReviews, []);
      assert.deepEqual(result.counts, counts([1, 1, 0, 0, 0]));
      const [entry] = (await stored(result.previewId)).entries;
      assert.equal(entry?.state, 'ready');
      assert.equal(String(entry?.requestId), String(supportRequest._id));
      assert.equal(
        entry?.originalFingerprint,
        supportRequestFingerprint(input),
      );
    });

    it('does not fail on legacy requests without a stored message', async () => {
      await rawUpdate(unset('message'));
      const result = await preview(suggestion(5));
      assert.equal(result.counts.skippedByReason['no-match'], 1);
    });

    it('treats activity exactly at the imported time as not newer, and anything later as newer', async () => {
      const updatedAt = new Date(UPDATED_AT);
      for (const field of ['lastActivityAt', 'statusChangedAt', 'sent']) {
        await rawUpdate(set(field, updatedAt));
        assert.equal((await preview(v1())).counts.eligible, 1, field);
        await rawUpdate(set(field, new Date(updatedAt.getTime() + 1)));
        const { counts: later } = await preview(v1());
        assert.equal(later.skippedByReason['newer-local-activity'], 1, field);
        await rawUpdate(set(field, sent));
      }
    });

    it('treats a matching ticket id with a different status as a change, not as applied', async () => {
      await update(set('zendeskTicketId', 789));
      const result = await preview(v1());
      assert.equal(result.counts.eligible, 1);
      assert.equal(result.counts.alreadyApplied, 0);
      assert.deepEqual(await apply(result), outcome(1, 0, 0));
      assert.equal((await storedRequest()).status, 'pending');
    });

    it('records the audit trail without personal data', async () => {
      const { manifest } = await mixedScenario();
      const result = await preview(manifest);
      const log = await auditFor('support-status-import/preview');
      assert.equal(String(log?.user), String(adminId));
      assert.deepEqual(log?.params, { previewId: result.previewId });
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
      const result = await preview(suggestion());
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
      assert.deepEqual(result.matchReviews, [
        {
          zendeskTicketId: 893,
          category: 'other',
          submittedAt: sent.toISOString(),
          importedStatus: 'pending',
          candidates: [candidate],
        },
      ]);
      assert.deepEqual(result.counts, counts([1, 0, 1, 0, 0]));
      const details = { username: 'fictional-name', subject: 'Fictional' };
      await update({ $set: details });
      const withDetails = await preview(suggestion());
      assert.deepEqual(withDetails.matchReviews[0]?.candidates, [
        {
          ...candidate,
          senderUsername: details.username,
          subject: 'Fictional',
        },
      ]);
    });

    it('stores the evidence and a snapshot of each suggested candidate', async () => {
      await update({
        $set: {
          statusChangedAt: CHANGED_AT,
          lastActivityAt: ACTIVITY_AT,
          statusRevision: 4,
        },
      });
      const result = await preview(suggestion());
      const [entry] = (await stored(result.previewId)).entries;
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
      assert.deepEqual(await snapshot(result.previewId), [
        'open',
        4,
        CHANGED_AT.getTime(),
        ACTIVITY_AT.getTime(),
        sent.getTime(),
        null,
      ]);
    });

    it('keeps the matching window inclusive and reports whole seconds', async () => {
      const atWindow = await preview(suggestion(1, at(-MINUTE)));
      assert.equal(atWindow.counts.suggested, 1);
      const [review] = atWindow.matchReviews;
      assert.equal(review?.candidates[0]?.timeDifferenceSeconds, 60);
      const beyond = await preview(suggestion(2, at(-MINUTE - 1)));
      assert.equal(beyond.counts.suggested, 0);
      const wide = await preview(suggestion(3, at(125_500)), '5');
      const [wideReview] = wide.matchReviews;
      assert.equal(wideReview?.candidates[0]?.timeDifferenceSeconds, 125);
    });

    it('only suggests requests that are free to take the ticket', async () => {
      await update(set('zendeskTicketId', 111));
      const otherTicket = await preview(suggestion(5));
      assert.equal(otherTicket.counts.suggested, 0);
      assert.equal(otherTicket.counts.skippedByReason['no-match'], 1);
      await rawUpdate(set('zendeskTicketId', null));
      assert.equal((await preview(suggestion(5))).counts.suggested, 1);
    });

    it('does not suggest a request that another item already matches exactly', async () => {
      const result = await preview(
        v2([
          item({ evidence: evidence(input.message, null) }),
          evidenceItem(790, input.message),
        ]),
      );
      assert.equal(result.counts.eligible, 1);
      assert.equal(result.counts.suggested, 0);
      assert.equal(result.counts.skippedByReason['no-match'], 1);
      assert.deepEqual(await entryStates(result.previewId), [
        [789, 'ready', undefined],
        [790, 'skipped', 'no-match'],
      ]);
    });

    it('lets two items suggest the same request but never accepts it twice', async () => {
      const result = await preview(
        v2([
          evidenceItem(801, input.message),
          evidenceItem(802, input.message),
        ]),
      );
      assert.equal(result.counts.suggested, 2);
      const requestId = String(supportRequest._id);
      await assert.rejects(
        apply(result, [
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
    const own = ({ message }: SupportRequestFixture, zendeskTicketId: number) =>
      item({
        zendeskTicketId,
        fingerprint: fingerprint({ message }),
        evidence: evidence(message, null),
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
      const result = await preview(scenario.manifest);
      assert.deepEqual(
        result.counts,
        counts([7, 1, 2, 1, 3], { 'ticket-id-conflict': 1, 'no-match': 2 }),
      );
      assert.deepEqual(await entryStates(result.previewId), [
        [701, 'alreadyApplied', undefined],
        [702, 'ready', undefined],
        [703, 'suggested', undefined],
        [704, 'suggested', undefined],
        [705, 'skipped', 'ticket-id-conflict'],
        [706, 'skipped', 'no-match'],
        [707, 'skipped', 'no-match'],
      ]);
      assert.deepEqual(await apply(result), outcome(1, 1, 5));
      const log = await auditFor('support-status-import/apply');
      assert.equal(String(log?.user), String(adminId));
      assert.deepEqual(log?.params, { previewId: result.previewId });
      assert.deepEqual(log?.body, { eligible: 1, selectedSuggestions: 0 });
      const ready = await storedRequest(scenario.ready._id);
      assert.equal(ready.zendeskTicketId, 702);
      const suggestedA = await storedRequest(scenario.suggestedA._id);
      assert.equal(suggestedA.status, 'open');
    });

    it('applies a selected suggestion next to the exact matches', async () => {
      const scenario = await mixedScenario();
      const result = await preview(scenario.manifest);
      const applied = await apply(result, [
        { zendeskTicketId: 703, requestId: String(scenario.suggestedA._id) },
      ]);
      assert.deepEqual(applied, outcome(2, 1, 4));
      const log = await auditFor('support-status-import/apply');
      assert.deepEqual(log?.body, { eligible: 2, selectedSuggestions: 1 });
      const updated = await storedRequest(scenario.suggestedA._id);
      assert.equal(updated.status, 'pending');
      assert.equal(updated.zendeskTicketId, 703);
      const other = await storedRequest(scenario.suggestedB._id);
      assert.equal(other.zendeskTicketId, undefined);
      assert.deepEqual((await stored(result.previewId)).result, applied);
    });

    it('rejects selections that overlap exact matches, repeat, or are not suggestions', async () => {
      const scenario = await mixedScenario();
      const result = await preview(scenario.manifest);
      const id = (request: { _id: Types.ObjectId }) => String(request._id);
      const pick = (zendeskTicketId: number, requestId: string) => ({
        zendeskTicketId,
        requestId,
      });
      const [a, b] = [id(scenario.suggestedA), id(scenario.suggestedB)];
      const unrelated = id({ _id: new mongoose.Types.ObjectId() });
      const rejected: Array<[string, unknown[], object]> = [
        ['ticket of an applied match', [pick(701, a)], ONE_TO_ONE],
        ['ticket of a ready match', [pick(702, a)], ONE_TO_ONE],
        [
          'request of an applied match',
          [pick(703, id(scenario.alreadyApplied))],
          ONE_TO_ONE,
        ],
        [
          'request of a ready match',
          [pick(703, id(scenario.ready))],
          ONE_TO_ONE,
        ],
        ['a ticket selected twice', [pick(703, a), pick(703, b)], ONE_TO_ONE],
        ['a request selected twice', [pick(703, a), pick(704, a)], ONE_TO_ONE],
        ['a ticket without suggestions', [pick(999_999, a)], NOT_SUGGESTED],
        ['another ticket’s candidate', [pick(703, b)], NOT_SUGGESTED],
        ['an unrelated request', [pick(703, unrelated)], NOT_SUGGESTED],
        [
          'a skipped entry that names a request',
          [pick(705, id(scenario.conflicted))],
          NOT_SUGGESTED,
        ],
      ];
      for (const [label, selections, expected] of rejected) {
        await assert.rejects(apply(result, selections), expected, label);
      }
      // Rejected selections never claim the preview.
      const meta = await storedMeta(result.previewId);
      assert.equal(meta.result, undefined);
      assert.equal(meta.applyToken, undefined);
    });

    it('rejects malformed selections and previews', async () => {
      const result = await preview(v1());
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
      const badSelection = badRequest('Invalid support status selection.');
      for (const [label, selection] of selections) {
        await assert.rejects(apply(result, selection), badSelection, label);
      }
      const { previewId } = result;
      const badPreview = badRequest('Invalid support status preview.');
      for (const bad of [
        `x${previewId}`,
        `${previewId}x`,
        previewId.slice(1),
      ]) {
        await assert.rejects(applyPreview(bad, adminId), badPreview, bad);
      }
      await assert.rejects(applyPreview('', adminId), badPreview);
      await assert.rejects(
        applyPreview(String(new mongoose.Types.ObjectId()), adminId),
        { status: 404, message: 'Support status preview not found.' },
      );
    });

    it('answers a replayed apply with the saved result, whatever is sent with it', async () => {
      const result = await preview(v1());
      const first = await apply(result);
      assert.deepEqual(await apply(result, [{ bad: true }]), first);
      assert.equal((await storedRequest()).statusRevision, 1);
    });

    it('rejects an expired preview at the exact expiry time', async () => {
      const result = await preview(v1());
      const expiresAt = new Date('2030-01-01T00:00:00.000Z');
      await tamper(result, { $set: { expiresAt } });
      const clock = sinon.useFakeTimers({ now: expiresAt, toFake: ['Date'] });
      try {
        await assert.rejects(apply(result), {
          status: 410,
          message: 'Support status preview has expired.',
        });
      } finally {
        clock.restore();
      }
    });

    it('reports every stored outcome of a preview with only skipped entries', async () => {
      const dupTickets = await preview(
        v1Items(item(), item({ status: 'solved' })),
      );
      const dupPrints = await preview(
        v1Items(item(), item({ zendeskTicketId: 790 })),
      );
      const noMatch = await preview(v1({ fingerprint: 'f'.repeat(64) }));
      await createRequest(input.message, { sent: new Date('2024-01-02') });
      const ambiguous = await preview(v1());
      const cases: Array<[string, typeof noMatch, string, number]> = [
        ['duplicate ticket ids', dupTickets, 'duplicate-ticket-id', 2],
        ['duplicate fingerprints', dupPrints, 'duplicate-fingerprint', 2],
        ['no match', noMatch, 'no-match', 1],
        ['an ambiguous match', ambiguous, 'ambiguous-match', 1],
      ];
      for (const [label, result, reason, count] of cases) {
        const { entries } = await stored(result.previewId);
        assert.equal(entries.length, count, label);
        assert.ok(
          entries.every(
            entry => entry.state === 'skipped' && entry.reason === reason,
          ),
          label,
        );
        assert.deepEqual(await apply(result), outcome(0, 0, count), label);
      }
    });

    it('stores the request with every skip that matched one', async () => {
      // A request holding another ticket, and a ticket held by another request.
      await update(set('zendeskTicketId', 123));
      const heldByRequest = await preview(v1());
      await update(unset('zendeskTicketId'));
      await createRequest('Another request', { zendeskTicketId: 789 });
      const heldByOther = await preview(v1());
      await update(set('lastActivityAt', new Date('2026-01-01')));
      await SupportRequest.deleteMany({ _id: { $ne: supportRequest._id } });
      const newer = await preview(v1());

      for (const [result, reason] of [
        [heldByRequest, 'ticket-id-conflict'],
        [heldByOther, 'ticket-id-conflict'],
        [newer, 'newer-local-activity'],
      ] as const) {
        const { entries } = await stored(result.previewId);
        assert.equal(entries.length, 1, reason);
        assert.equal(entries[0]?.state, 'skipped');
        assert.equal(entries[0]?.reason, reason);
        assert.equal(String(entries[0]?.requestId), String(supportRequest._id));
        assert.deepEqual(await apply(result), outcome(0, 0, 1));
      }
    });

    it('stores skipped entries for sources that target one request twice', async () => {
      const message = 'Please help with a & b.';
      await update(set('message', message));
      const result = await preview(
        v1Items(
          item({ fingerprint: fingerprint({ message }) }),
          item({
            zendeskTicketId: 790,
            fingerprint: fingerprint({
              message: 'Please help with a &amp; b.',
            }),
          }),
        ),
      );
      const { entries } = await stored(result.previewId);
      const ambiguous = ['skipped', 'ambiguous-source-match'];
      assert.deepEqual(
        entries.map(entry => [entry.state, entry.reason]),
        [ambiguous, ambiguous],
      );
      assert.deepEqual(await apply(result), outcome(0, 0, 2));
    });

    it('counts a request that already has the imported state when applying', async () => {
      await update({ $set: { status: 'pending', zendeskTicketId: 789 } });
      const result = await preview(v1());
      const [entry] = (await stored(result.previewId)).entries;
      assert.equal(entry?.state, 'alreadyApplied');
      assert.deepEqual(await apply(result), outcome(0, 1, 0));
    });

    /** Replaces the fixture with a member report and previews its import. */
    async function reportMemberPreview(fields: Rec = {}) {
      await SupportRequest.deleteMany({});
      const request = await createRequest(input.message, {
        category: 'reportMember',
        reportMember: 'fictional-target',
        ...fields,
      });
      const result = await preview(
        v1({ fingerprint: fingerprint({ category: 'reportMember' }) }),
      );
      return { request, result };
    }

    it('applies requests whose every snapshot field is set', async () => {
      const { request, result } = await reportMemberPreview({
        statusRevision: 3,
        statusChangedAt: CHANGED_AT,
        lastActivityAt: ACTIVITY_AT,
        zendeskTicketId: 789,
      });
      assert.deepEqual(await snapshot(result.previewId), [
        'open',
        3,
        CHANGED_AT.getTime(),
        ACTIVITY_AT.getTime(),
        sent.getTime(),
        789,
      ]);
      assert.deepEqual(await apply(result), outcome(1, 0, 0));
      const updated = await storedRequest(request._id);
      assert.equal(updated.status, 'pending');
      assert.equal(updated.statusRevision, 4);
      assert.equal(updated.zendeskTicketId, 789);
      assert.equal(updated.reportMember, 'fictional-target');
      assert.ok(updated.statusChangedAt! > CHANGED_AT);
      assert.equal(updated.lastActivityAt?.getTime(), ACTIVITY_AT.getTime());
    });

    it('keeps the reported member in the write guard', async () => {
      const { result } = await reportMemberPreview();
      assert.deepEqual(await apply(result), outcome(1, 0, 0));
    });

    it('applies a legacy request that has no revision yet', async () => {
      await rawUpdate(unset('statusRevision'));
      assert.deepEqual(await apply(await preview(v1())), outcome(1, 0, 0));
      assert.equal((await storedRequest()).statusRevision, 1);
    });

    it('sets the resolution time only for solved and closed statuses', async () => {
      for (const [status, resolved] of [
        ['solved', true],
        ['closed', true],
        ['pending', false],
        ['open', false],
      ] as const) {
        await update({
          $set: { status: status === 'open' ? 'new' : 'open' },
          $unset: { zendeskTicketId: '', statusChangedAt: '' },
        });
        await apply(await preview(v1({ status })));
        const updated = await storedRequest();
        assert.equal(updated.status, status);
        assert.equal(
          updated.resolvedAt?.toISOString() ?? null,
          resolved ? UPDATED_AT : null,
          status,
        );
      }
    });

    /** Recreates the only request with these fields and previews its import. */
    async function freshPreview(fields: Rec) {
      sinon.restore();
      await SupportRequest.deleteMany({});
      const request = await createRequest(input.message, fields);
      return { request, result: await preview(v1()) };
    }

    it('never writes when the request changed after the preview', async () => {
      const changes: Array<[string, unknown]> = [
        ['status', 'solved'],
        ['statusRevision', 4],
        ['statusChangedAt', LATER],
        ['lastActivityAt', LATER],
        ['sent', LATER],
        ['zendeskTicketId', 555],
      ];
      for (const [field, value] of changes) {
        const { request, result } = await freshPreview({
          statusChangedAt: CHANGED_AT,
        });
        await SupportRequest.collection.updateOne(
          { _id: request._id },
          set(field, value),
        );
        const updateOne = sinon.spy(SupportRequest, 'updateOne');
        assert.deepEqual(await apply(result), outcome(0, 0, 1), field);
        assert.equal(updateOne.called, false, field);
      }
    });

    it('rejects a concurrent change to any snapshot field at write time', async () => {
      const original = {
        status: 'open',
        statusRevision: 2,
        statusChangedAt: CHANGED_AT,
        lastActivityAt: ACTIVITY_AT,
        zendeskTicketId: 789,
      };
      // Fields that were empty at preview time stay guarded as empty.
      const changes: Array<[string, Rec, Rec]> = [
        ['status', original, set('status', 'solved')],
        ['statusRevision', original, set('statusRevision', 9)],
        ['statusChangedAt', original, set('statusChangedAt', LATER)],
        ['statusChangedAt removed', original, unset('statusChangedAt')],
        ['lastActivityAt', original, set('lastActivityAt', LATER)],
        ['lastActivityAt removed', original, unset('lastActivityAt')],
        ['sent', original, set('sent', LATER)],
        ['zendeskTicketId removed', original, unset('zendeskTicketId')],
        ['empty lastActivityAt', {}, set('lastActivityAt', LATER)],
        ['empty statusChangedAt', {}, set('statusChangedAt', LATER)],
        ['empty zendeskTicketId', {}, set('zendeskTicketId', 555)],
      ];
      for (const [label, fields, change] of changes) {
        const { request, result } = await freshPreview(fields);
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
        assert.deepEqual(await apply(result), outcome(0, 0, 1), label);
      }
    });

    describe('suggested matches are rechecked at apply time', () => {
      async function suggested(itemSent: Date = sent, window?: string) {
        const result = await preview(suggestion(893, itemSent), window);
        assert.equal(result.counts.suggested, 1);
        return result;
      }
      const select = (target: { previewId: string }) =>
        apply(target, [
          { zendeskTicketId: 893, requestId: String(supportRequest._id) },
        ]);

      it('skips when any stored piece of evidence is missing or differs', async () => {
        const tampering: Array<[string, Rec]> = [
          ['no senderHash', unset('entries.0.senderHash')],
          ['no category', unset('entries.0.category')],
          [
            'no normalisedMessageHash',
            unset('entries.0.normalisedMessageHash'),
          ],
          ['no submittedAt', unset('entries.0.submittedAt')],
          ['another senderHash', set('entries.0.senderHash', 'f'.repeat(64))],
          ['another category', set('entries.0.category', 'account')],
          [
            'another message hash',
            set('entries.0.normalisedMessageHash', 'e'.repeat(64)),
          ],
          [
            'a submission time outside the window',
            set('entries.0.submittedAt', at(-MINUTE - 1)),
          ],
        ];
        for (const [label, change] of tampering) {
          sinon.restore();
          const result = await suggested();
          await tamper(result, change);
          assert.deepEqual(await select(result), outcome(0, 0, 1), label);
          const unchanged = await storedRequest();
          assert.equal(unchanged.status, 'open', label);
          assert.equal(unchanged.zendeskTicketId, undefined, label);
        }
      });

      it('applies a submission time exactly at the window and skips one just beyond', async () => {
        const atWindow = await suggested(at(MINUTE));
        assert.deepEqual(await select(atWindow), outcome(1, 0, 0));
        await update({ ...set('status', 'open'), ...unset('zendeskTicketId') });
        const beyond = await suggested(at(MINUTE));
        await tamper(beyond, set('entries.0.submittedAt', at(MINUTE + 1)));
        assert.deepEqual(await select(beyond), outcome(0, 0, 1));
      });

      it('enforces the stored window, and one minute for legacy previews', async () => {
        const wide = await suggested(at(-2 * MINUTE), '5');
        await tamper(wide, set('matchingWindowMinutes', 1));
        assert.deepEqual(await select(wide), outcome(0, 0, 1));

        const legacy = await suggested(at(-2 * MINUTE), '5');
        await tamper(legacy, { $unset: { matchingWindowMinutes: 1 } });
        assert.deepEqual(await select(legacy), outcome(0, 0, 1));

        const intact = await suggested(at(-2 * MINUTE), '5');
        assert.equal((await stored(intact.previewId)).matchingWindowMinutes, 5);
        assert.deepEqual(await select(intact), outcome(1, 0, 0));
      });
    });

    describe('failures', () => {
      const failAudit = (error: Error) =>
        sinon.stub(AuditLog.prototype, 'save').rejects(error);
      const claimedElsewhere = (target: { previewId: string }) =>
        tamper(target, set('applyToken', 'another-apply'));

      it('never leaks the detail of a storage failure, whatever its status', async () => {
        for (const status of [500, 503, undefined]) {
          sinon.restore();
          const result = await preview(v1());
          failAudit(Object.assign(new Error('private detail'), { status }));
          await assert.rejects(apply(result), {
            status: 500,
            message: 'Unable to apply support status import.',
          });
        }
      });

      it('releases only its own claim after a failure', async () => {
        const other = await preview(v1());
        await claimedElsewhere(other);
        const own = await preview(v1());
        failAudit(new Error('private detail'));
        await assert.rejects(apply(own), { status: 500 });
        const otherMeta = await storedMeta(other.previewId);
        assert.equal(otherMeta.applyToken, 'another-apply');
        assert.equal((await storedMeta(own.previewId)).applyToken, undefined);
      });

      it('completes and releases only its own preview', async () => {
        const other = await preview(v1());
        const own = await preview(v1());
        const result = await apply(own);
        assert.deepEqual(result, outcome(1, 0, 0));
        const done = await storedMeta(own.previewId);
        assert.deepEqual(done.result, result);
        assert.equal(done.applyToken, undefined);
        assert.ok(done.appliedAt instanceof Date);
        const untouched = await storedMeta(other.previewId);
        assert.equal(untouched.result, undefined);
        assert.equal(untouched.appliedAt, undefined);
        assert.equal(untouched.applyToken, undefined);
      });

      it('does not hand out another preview’s result when the claim is lost', async () => {
        const finished = await preview(v1());
        const busy = await preview(v1());
        await apply(finished);
        await claimedElsewhere(busy);
        await assert.rejects(apply(busy), CLAIM_LOST);
      });

      it('reports a conflict when the preview disappears while its claim is lost', async () => {
        const result = await preview(v1());
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
        await assert.rejects(apply(result), CLAIM_LOST);
      });
    });
  });
});
