import type { Types } from 'mongoose';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const emailService: typeof import('../../../core/server/services/email.server.service.mjs') = require('../../../core/server/services/email.server.service.mjs');
const {
  extractTicketStatusItem,
}: typeof import('../../../../bin/db-maintenance/prepare-zendesk-statuses.mts') = require('../../../../bin/db-maintenance/prepare-zendesk-statuses.mts');
const {
  applyPreview,
  previewReducedManifest,
}: typeof import('../../server/services/status-import.server.service.mts') = require('../../server/services/status-import.server.service.mts');
const {
  normaliseStoredSupportCategory,
  supportRequestFingerprint,
  supportRequestImportFingerprints,
}: typeof import('../../server/services/support-fingerprint.server.service.mts') = require('../../server/services/support-fingerprint.server.service.mts');

interface SupportRequestFixture {
  _id: Types.ObjectId;
  category: string;
  email: string;
  message: string;
  reportMember?: string;
  status: string;
  statusRevision: number;
  statusChangedAt?: Date;
  lastActivityAt?: Date;
  sent: Date;
  zendeskTicketId?: number;
  resolvedAt?: Date | null;
}

const SupportRequest = mongoose.model<SupportRequestFixture>('SupportRequest');
const AuditLog = mongoose.model('AuditLog');
const PreviewModel = mongoose.model('SupportStatusImportPreview');

describe('conservative support status import', () => {
  let adminId: Types.ObjectId;
  let supportRequest: SupportRequestFixture;
  const input = {
    category: 'other' as const,
    email: 'visitor@example.org',
    message: 'A fictional request for help.',
  };

  beforeEach(async () => {
    const generated = utils.generateUsersWithSharedPassword(1);
    generated[0]!.roles = ['user', 'admin'];
    const [admin] = await utils.saveUsers(generated);
    adminId = admin!._id;
    supportRequest = await SupportRequest.create({
      ...input,
      status: 'open',
      sent: new Date('2024-01-01T00:00:00.000Z'),
    });
  });

  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });

  function manifest(
    overrides: Record<string, unknown> = {},
    fingerprint = supportRequestFingerprint(input),
  ) {
    return {
      version: 1,
      exportedAt: '2025-01-01T00:00:00.000Z',
      items: [
        {
          zendeskTicketId: 789,
          status: 'pending',
          updatedAt: '2025-01-01T00:00:00.000Z',
          fingerprint,
          ...overrides,
        },
      ],
    };
  }

  function renderSupportRequest(message: string) {
    return new Promise<string>((resolve, reject) => {
      emailService.renderEmail(
        'support-request',
        {
          from: 'Trustroots Support <support@example.org>',
          name: 'Trustroots Support',
          email: 'support@example.org',
          replyTo: { address: input.email },
          subject: 'Support request [Other]',
          request: {
            category: 'other',
            categoryLabel: 'Other',
            email: input.email,
            message,
            username: 'fictional-member',
            authenticated: 'no',
          },
          skipHtmlTemplate: true,
          sparkpostCampaign: 'support-request',
        },
        (error, rendered) => {
          if (error) reject(error);
          else resolve(rendered!.text);
        },
      );
    });
  }

  it('previews an exact match, applies once, and remains idempotent', async () => {
    const preview = await previewReducedManifest(manifest(), adminId);
    assert.equal(preview.counts.total, 1);
    assert.equal(preview.counts.eligible, 1);
    assert.equal(preview.changes[0]?.currentStatus, 'open');
    assert.equal(preview.changes[0]?.importedStatus, 'pending');
    assert.equal(JSON.stringify(preview).includes(input.email), false);
    assert.equal(JSON.stringify(preview).includes(input.message), false);

    assert.deepEqual(await applyPreview(preview.previewId, adminId), {
      applied: 1,
      alreadyApplied: 0,
      skipped: 0,
    });
    assert.deepEqual(await applyPreview(preview.previewId, adminId), {
      applied: 1,
      alreadyApplied: 0,
      skipped: 0,
    });
    const updated = await SupportRequest.findById(supportRequest._id).lean();
    assert.equal(updated?.status, 'pending');
    assert.equal(updated?.zendeskTicketId, 789);
    assert.equal(updated?.statusRevision, 1);
  });

  it('normalises known historical category omissions without using usernames', async () => {
    assert.equal(normaliseStoredSupportCategory(undefined), 'other');
    assert.equal(
      normaliseStoredSupportCategory(undefined, 'fictional-target'),
      'reportMember',
    );
    assert.equal(normaliseStoredSupportCategory('account'), 'account');
    assert.equal(normaliseStoredSupportCategory('unknown-category'), null);

    await SupportRequest.collection.updateOne(
      { _id: supportRequest._id },
      { $unset: { category: '' } },
    );
    const preview = await previewReducedManifest(manifest(), adminId);
    assert.equal(preview.counts.eligible, 1);

    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $set: { reportMember: 'fictional-target' } },
    );
    const reportFingerprint = supportRequestFingerprint({
      ...input,
      category: 'reportMember',
    });
    const reportPreview = await previewReducedManifest(
      manifest({}, reportFingerprint),
      adminId,
    );
    assert.equal(reportPreview.counts.eligible, 1);
  });

  it('atomically rejects a legacy identity change between the apply read and write', async () => {
    await SupportRequest.collection.updateOne(
      { _id: supportRequest._id },
      {
        $unset: { category: '' },
        $set: { reportMember: 'fictional-target' },
      },
    );
    const preview = await previewReducedManifest(
      manifest(
        {},
        supportRequestFingerprint({
          ...input,
          category: 'reportMember',
        }),
      ),
      adminId,
    );
    assert.equal(preview.counts.eligible, 1);

    const originalUpdateOne = SupportRequest.updateOne.bind(SupportRequest);
    const updateStub = sinon
      .stub(SupportRequest, 'updateOne')
      .callsFake((async (
        ...args: Parameters<typeof SupportRequest.updateOne>
      ) => {
        await SupportRequest.collection.updateOne(
          { _id: supportRequest._id },
          { $set: { reportMember: 'another-fictional-target' } },
        );
        return originalUpdateOne(...args);
      }) as never);

    assert.deepEqual(await applyPreview(preview.previewId, adminId), {
      applied: 0,
      alreadyApplied: 0,
      skipped: 1,
    });
    assert.equal(updateStub.calledOnce, true);
    const updated = await SupportRequest.findById(supportRequest._id).lean();
    assert.equal(updated?.status, 'open');
    assert.equal(updated?.zendeskTicketId, undefined);
    assert.equal(updated?.reportMember, 'another-fictional-target');
  });

  it('reproduces historical escaping and URL expansion without changing identity or ordinary text', () => {
    const original = {
      ...input,
      email: 'a&b@example.org',
      message: `Please compare <one> & "two" with 'three'.`,
    };
    assert.deepEqual(supportRequestImportFingerprints(original), [
      supportRequestFingerprint(original),
      supportRequestFingerprint({
        ...original,
        email: 'a&amp;b@example.org',
        message:
          'Please compare &lt;one&gt; &amp; &quot;two&quot; with &#39;three&#39;.',
      }),
    ]);
    assert.deepEqual(supportRequestImportFingerprints(input), [
      supportRequestFingerprint(input),
    ]);
    assert.ok(
      supportRequestImportFingerprints({
        ...input,
        message: 'See www.example.org/help or write to help@example.org.',
      }).includes(
        supportRequestFingerprint({
          ...input,
          message:
            'See http://www.example.org/help or write to help@example.org.',
        }),
      ),
    );
  });

  it('matches URL canonicalisation produced by the email renderer and preparation parser', async () => {
    const message = 'See www.example.org/help, then reply if needed.';
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $set: { message } },
    );
    const renderedBody = await renderSupportRequest(message);
    const item = extractTicketStatusItem({
      id: 789,
      status: 'pending',
      updated_at: '2025-01-01T00:00:00.000Z',
      description: renderedBody,
    });
    assert.ok(item);
    assert.equal(
      item.fingerprint,
      supportRequestFingerprint({
        ...input,
        message: 'See http://www.example.org/help, then reply if needed.',
      }),
    );
    const preview = await previewReducedManifest(
      manifest(
        { status: item.status, updatedAt: item.updatedAt },
        item.fingerprint,
      ),
      adminId,
    );
    assert.equal(preview.counts.eligible, 1);
    assert.deepEqual(await applyPreview(preview.previewId, adminId), {
      applied: 1,
      alreadyApplied: 0,
      skipped: 0,
    });
  });

  for (const [description, message, rendered] of [
    [
      'HTML escaping',
      `I can't use "account & settings".`,
      'I can&#39;t use &quot;account &amp; settings&quot;.',
    ],
    [
      'URL expansion',
      'The link is www.example.org/help.',
      'The link is http://www.example.org/help.',
    ],
  ]) {
    it(`previews and applies ${description} with the existing manifest and remains idempotent`, async () => {
      await SupportRequest.updateOne(
        { _id: supportRequest._id },
        { $set: { message } },
      );
      const source = manifest(
        { status: 'closed' },
        supportRequestFingerprint({ ...input, message: rendered! }),
      );
      const preview = await previewReducedManifest(source, adminId);
      assert.equal(preview.counts.eligible, 1);
      assert.equal(
        (await SupportRequest.findById(supportRequest._id).lean())?.status,
        'open',
      );
      assert.deepEqual(await applyPreview(preview.previewId, adminId), {
        applied: 1,
        alreadyApplied: 0,
        skipped: 0,
      });
      assert.equal(
        (await previewReducedManifest(source, adminId)).counts.alreadyApplied,
        1,
      );
      const updated = await SupportRequest.findById(supportRequest._id).lean();
      assert.equal(updated?.message, message);
      assert.equal(updated?.email, input.email);
      assert.equal(updated?.zendeskTicketId, 789);
      assert.equal(updated?.status, 'closed');
    });
  }

  it('skips collisions between an original request and another request’s rendered text', async () => {
    const message = 'Please help with a & b.';
    const rendered = 'Please help with a &amp; b.';
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $set: { message } },
    );
    await SupportRequest.create({
      ...input,
      message: rendered,
      sent: new Date('2024-01-01'),
    });
    const preview = await previewReducedManifest(
      manifest({}, supportRequestFingerprint({ ...input, message: rendered })),
      adminId,
    );
    assert.equal(preview.counts.eligible, 0);
    assert.equal(preview.counts.skippedByReason['ambiguous-match'], 1);
    assert.equal((await applyPreview(preview.previewId, adminId)).applied, 0);
  });

  it('skips every source ticket when different renderings target the same request', async () => {
    const message = 'Please help with a & b.';
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $set: { message } },
    );
    const source = manifest(
      {},
      supportRequestFingerprint({ ...input, message }),
    );
    source.items.push({
      ...source.items[0]!,
      zendeskTicketId: 790,
      fingerprint: supportRequestFingerprint({
        ...input,
        message: 'Please help with a &amp; b.',
      }),
    });
    for (const items of [source.items, [...source.items].reverse()]) {
      const preview = await previewReducedManifest(
        { ...source, items },
        adminId,
      );
      assert.equal(preview.counts.eligible, 0);
      assert.equal(preview.counts.skippedByReason['ambiguous-source-match'], 2);
      assert.equal((await applyPreview(preview.previewId, adminId)).applied, 0);
    }
  });

  it('rejects changed original text even when its new rendering still matches the preview', async () => {
    const message = 'The link is www.example.org/help.';
    const rendered = 'The link is http://www.example.org/help.';
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $set: { message } },
    );
    const source = manifest(
      {},
      supportRequestFingerprint({ ...input, message: rendered }),
    );
    const preview = await previewReducedManifest(source, adminId);
    assert.equal(preview.counts.eligible, 1);
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $set: { message: rendered } },
    );
    assert.deepEqual(await applyPreview(preview.previewId, adminId), {
      applied: 0,
      alreadyApplied: 0,
      skipped: 1,
    });
  });

  it('still skips newer activity for rendered matches and accepts existing exact previews', async () => {
    const legacyPreview = await previewReducedManifest(manifest(), adminId);
    await PreviewModel.updateOne(
      { _id: legacyPreview.previewId },
      { $unset: { 'entries.0.originalFingerprint': '' } },
    );
    assert.equal(
      (await applyPreview(legacyPreview.previewId, adminId)).applied,
      1,
    );
    const message = 'Please help with a & b.';
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      {
        $set: { message, lastActivityAt: new Date('2026-01-01') },
        $unset: { zendeskTicketId: '' },
      },
    );
    const preview = await previewReducedManifest(
      manifest(
        {},
        supportRequestFingerprint({
          ...input,
          message: 'Please help with a &amp; b.',
        }),
      ),
      adminId,
    );
    assert.equal(preview.counts.skippedByReason['newer-local-activity'], 1);
  });

  it('records a historical resolution time and a current status-change time', async () => {
    const sourceUpdatedAt = '2025-01-01T00:00:00.000Z';
    const preview = await previewReducedManifest(
      manifest({ status: 'closed' }),
      adminId,
    );
    await applyPreview(preview.previewId, adminId);
    const updated = await SupportRequest.findById(supportRequest._id).lean();
    assert.equal(updated?.status, 'closed');
    assert.equal(updated?.resolvedAt?.toISOString(), sourceUpdatedAt);
    assert.ok(updated?.statusChangedAt instanceof Date);
  });

  it('skips duplicate manifest identifiers and fingerprints', async () => {
    const duplicateTicketManifest = manifest();
    duplicateTicketManifest.items.push({
      ...duplicateTicketManifest.items[0]!,
      status: 'solved',
    });
    const duplicateTickets = await previewReducedManifest(
      duplicateTicketManifest,
      adminId,
    );
    assert.equal(duplicateTickets.counts.skipped, 2);
    assert.equal(
      duplicateTickets.counts.skippedByReason['duplicate-ticket-id'],
      2,
    );

    const duplicateFingerprintManifest = manifest();
    duplicateFingerprintManifest.items.push({
      ...duplicateFingerprintManifest.items[0]!,
      zendeskTicketId: 790,
    });
    const duplicateFingerprints = await previewReducedManifest(
      duplicateFingerprintManifest,
      adminId,
    );
    assert.equal(duplicateFingerprints.counts.skipped, 2);
    assert.equal(
      duplicateFingerprints.counts.skippedByReason['duplicate-fingerprint'],
      2,
    );
  });

  it('skips ticket IDs already assigned to a different request', async () => {
    await SupportRequest.create({
      category: 'other',
      email: 'different@example.org',
      message: 'A different fictional request.',
      status: 'open',
      sent: new Date('2024-01-02T00:00:00.000Z'),
      zendeskTicketId: 789,
    });
    const preview = await previewReducedManifest(manifest(), adminId);
    assert.equal(preview.counts.eligible, 0);
    assert.equal(preview.counts.skippedByReason['ticket-id-conflict'], 1);
  });

  it('skips unmatched requests and requests already assigned another ticket ID', async () => {
    const noMatch = await previewReducedManifest(
      manifest({}, 'f'.repeat(64)),
      adminId,
    );
    assert.equal(noMatch.counts.skippedByReason['no-match'], 1);

    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $set: { zendeskTicketId: 123 } },
    );
    const conflict = await previewReducedManifest(manifest(), adminId);
    assert.equal(conflict.counts.skippedByReason['ticket-id-conflict'], 1);
  });

  it('recognises an already imported status and ticket pair', async () => {
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $set: { status: 'pending', zendeskTicketId: 789 } },
    );
    const preview = await previewReducedManifest(manifest(), adminId);
    assert.equal(preview.counts.alreadyApplied, 1);
    assert.equal(preview.counts.eligible, 0);
  });

  it('skips legacy rows without fingerprint fields and applies null snapshot fields', async () => {
    await SupportRequest.collection.updateOne(
      { _id: supportRequest._id },
      {
        $unset: {
          email: '',
          statusRevision: '',
          sent: '',
          statusChangedAt: '',
        },
      },
    );
    const unmatched = await previewReducedManifest(manifest(), adminId);
    assert.equal(unmatched.counts.skippedByReason['no-match'], 1);

    await SupportRequest.collection.updateOne(
      { _id: supportRequest._id },
      {
        $set: { email: input.email },
        $unset: { statusRevision: '', sent: '', statusChangedAt: '' },
      },
    );
    const preview = await previewReducedManifest(manifest(), adminId);
    assert.equal(preview.counts.eligible, 1);
    assert.deepEqual(await applyPreview(preview.previewId, adminId), {
      applied: 1,
      alreadyApplied: 0,
      skipped: 0,
    });
  });

  it('skips ambiguous and newer local matches without changing them', async () => {
    await SupportRequest.create({
      ...input,
      status: 'open',
      sent: new Date('2024-01-02T00:00:00.000Z'),
    });
    const ambiguous = await previewReducedManifest(manifest(), adminId);
    assert.equal(ambiguous.counts.skipped, 1);
    assert.equal(ambiguous.counts.skippedByReason['ambiguous-match'], 1);

    await SupportRequest.deleteMany({ _id: { $ne: supportRequest._id } });
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $set: { statusChangedAt: new Date('2026-01-01T00:00:00.000Z') } },
    );
    const newer = await previewReducedManifest(manifest(), adminId);
    assert.equal(newer.counts.eligible, 0);
    assert.equal(newer.counts.skippedByReason['newer-local-activity'], 1);
  });

  it('skips a request changed after preview and rejects a non-administrator', async () => {
    const preview = await previewReducedManifest(manifest(), adminId);
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      {
        $set: { status: 'solved', statusChangedAt: new Date() },
        $inc: { statusRevision: 1 },
      },
    );
    assert.deepEqual(await applyPreview(preview.previewId, adminId), {
      applied: 0,
      alreadyApplied: 0,
      skipped: 1,
    });

    const generated = utils.generateUsersWithSharedPassword(1);
    const [nonAdmin] = await utils.saveUsers(generated);
    await assert.rejects(
      previewReducedManifest(manifest(), nonAdmin!._id),
      /administrator/,
    );
  });

  it('skips a compare-and-set miss without overwriting the concurrent change', async () => {
    const preview = await previewReducedManifest(manifest(), adminId);
    sinon
      .stub(SupportRequest, 'updateOne')
      .resolves({ modifiedCount: 0 } as never);
    assert.deepEqual(await applyPreview(preview.previewId, adminId), {
      applied: 0,
      alreadyApplied: 0,
      skipped: 1,
    });
  });

  it('counts a request as already applied if it changes to the imported state after preview', async () => {
    const preview = await previewReducedManifest(manifest(), adminId);
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $set: { status: 'pending', zendeskTicketId: 789 } },
    );
    assert.deepEqual(await applyPreview(preview.previewId, adminId), {
      applied: 0,
      alreadyApplied: 1,
      skipped: 0,
    });
  });

  it('skips a request whose original message changes after preview', async () => {
    const preview = await previewReducedManifest(manifest(), adminId);
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $set: { message: 'A changed fictional request.' } },
    );
    assert.deepEqual(await applyPreview(preview.previewId, adminId), {
      applied: 0,
      alreadyApplied: 0,
      skipped: 1,
    });
    const unchanged = await SupportRequest.findById(supportRequest._id).lean();
    assert.equal(unchanged?.status, 'open');
    assert.equal(unchanged?.zendeskTicketId, undefined);
  });

  it('returns a conflict while another apply owns the preview claim', async () => {
    const preview = await previewReducedManifest(manifest(), adminId);
    await PreviewModel.updateOne(
      { _id: preview.previewId },
      { $set: { applyToken: 'another-apply' } },
    );
    await assert.rejects(
      applyPreview(preview.previewId, adminId),
      /already being applied/,
    );
    const unchanged = await SupportRequest.findById(supportRequest._id).lean();
    assert.equal(unchanged?.status, 'open');
  });

  it('handles a preview entry whose request has disappeared', async () => {
    const preview = await previewReducedManifest(manifest(), adminId);
    await PreviewModel.updateOne(
      { _id: preview.previewId },
      { $unset: { 'entries.0.requestId': '', 'entries.0.statusRevision': '' } },
    );
    assert.deepEqual(await applyPreview(preview.previewId, adminId), {
      applied: 0,
      alreadyApplied: 0,
      skipped: 1,
    });
  });

  it('uses safe defaults for legacy revisions but rejects a changed revision', async () => {
    const preview = await previewReducedManifest(manifest(), adminId);
    await PreviewModel.updateOne(
      { _id: preview.previewId },
      { $unset: { 'entries.0.statusRevision': '' } },
    );
    await SupportRequest.collection.updateOne(
      { _id: supportRequest._id },
      { $unset: { statusRevision: '' } },
    );
    assert.deepEqual(await applyPreview(preview.previewId, adminId), {
      applied: 1,
      alreadyApplied: 0,
      skipped: 0,
    });

    await SupportRequest.collection.updateOne(
      { _id: supportRequest._id },
      {
        $set: { status: 'open', statusRevision: 0 },
        $unset: { zendeskTicketId: '' },
      },
    );
    const nextPreview = await previewReducedManifest(
      manifest({ zendeskTicketId: 790 }),
      adminId,
    );
    await SupportRequest.collection.updateOne(
      { _id: supportRequest._id },
      { $set: { statusRevision: 9 } },
    );
    assert.deepEqual(await applyPreview(nextPreview.previewId, adminId), {
      applied: 0,
      alreadyApplied: 0,
      skipped: 1,
    });
  });

  it('returns a result saved by a concurrent apply after losing the claim', async () => {
    const preview = await previewReducedManifest(manifest(), adminId);
    const result = { applied: 0, alreadyApplied: 1, skipped: 0 };
    let reads = 0;
    const originalFindOne = PreviewModel.findOne.bind(PreviewModel);
    sinon.stub(PreviewModel, 'findOne').callsFake(((...args: unknown[]) => {
      reads++;
      if (reads === 2) {
        return {
          lean: async () => ({ result }),
        } as never;
      }
      return originalFindOne(
        ...(args as Parameters<typeof PreviewModel.findOne>),
      );
    }) as never);
    sinon.stub(PreviewModel, 'findOneAndUpdate').returns({
      lean: async () => null,
    } as never);
    assert.deepEqual(await applyPreview(preview.previewId, adminId), result);
  });

  it('reports a conflict when its claimed preview cannot be completed', async () => {
    const preview = await previewReducedManifest(manifest(), adminId);
    const originalFindOneAndUpdate =
      PreviewModel.findOneAndUpdate.bind(PreviewModel);
    let updates = 0;
    sinon.stub(PreviewModel, 'findOneAndUpdate').callsFake(((
      ...args: unknown[]
    ) => {
      updates++;
      if (updates === 2) {
        return { lean: async () => null } as never;
      }
      return originalFindOneAndUpdate(
        ...(args as Parameters<typeof PreviewModel.findOneAndUpdate>),
      );
    }) as never);
    await assert.rejects(
      applyPreview(preview.previewId, adminId),
      /changed during apply/,
    );
  });

  it('releases its apply claim and fails closed when audit storage fails', async () => {
    const preview = await previewReducedManifest(manifest(), adminId);
    sinon.stub(AuditLog.prototype, 'save').rejects(new Error('private detail'));
    await assert.rejects(
      applyPreview(preview.previewId, adminId),
      /Unable to apply support status import/,
    );
    const stored = await PreviewModel.findById(preview.previewId).lean();
    const storedPreview = stored as unknown as {
      applyToken?: string;
      result?: unknown;
    } | null;
    assert.equal(storedPreview?.applyToken, undefined);
    assert.equal(storedPreview?.result, undefined);
  });

  it('persists one deterministic result for simultaneous apply requests', async () => {
    const preview = await previewReducedManifest(manifest(), adminId);
    const results = await Promise.allSettled([
      applyPreview(preview.previewId, adminId),
      applyPreview(preview.previewId, adminId),
    ]);
    const fulfilled = results.filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<typeof applyPreview>>
      > => result.status === 'fulfilled',
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    assert.ok(fulfilled.length >= 1);
    assert.ok(fulfilled.every(result => result.value.applied === 1));
    assert.ok(
      rejected.every(
        result => (result.reason as { status?: number }).status === 409,
      ),
    );
    const updated = await SupportRequest.findById(supportRequest._id).lean();
    assert.equal(updated?.statusRevision, 1);
  });

  it('fails closed when metadata-only audit storage is unavailable', async () => {
    sinon.stub(AuditLog.prototype, 'save').rejects(new Error('private detail'));
    await assert.rejects(
      previewReducedManifest(manifest(), adminId),
      /Unable to prepare support status import/,
    );
    assert.equal(await PreviewModel.countDocuments(), 0);
  });

  it('enforces preview actor binding and expiry', async () => {
    const preview = await previewReducedManifest(manifest(), adminId);
    const anotherAdminFixture = utils.generateUsersWithSharedPassword(1);
    anotherAdminFixture[0]!.roles = ['user', 'admin'];
    const [anotherAdmin] = await utils.saveUsers(anotherAdminFixture);
    await assert.rejects(
      applyPreview(preview.previewId, anotherAdmin!._id),
      /not found/,
    );
    await PreviewModel.updateOne(
      { _id: preview.previewId },
      { $set: { expiresAt: new Date('2020-01-01T00:00:00.000Z') } },
    );
    await assert.rejects(applyPreview(preview.previewId, adminId), /expired/);
  });

  it('rejects malformed manifests before creating a preview', async () => {
    await assert.rejects(
      previewReducedManifest(manifest({ status: 'escalated' }), adminId),
      /Invalid support status manifest/,
    );
    await assert.rejects(
      previewReducedManifest(
        {
          ...manifest(),
          items: Array(10_001).fill(manifest().items[0]),
        },
        adminId,
      ),
      /Invalid support status manifest/,
    );
    await assert.rejects(
      previewReducedManifest(
        { ...manifest(), exportedAt: 'not-a-date' },
        adminId,
      ),
      /Invalid support status manifest/,
    );
    await assert.rejects(
      previewReducedManifest(manifest({ updatedAt: '' }), adminId),
      /Invalid support status manifest/,
    );
    await assert.rejects(
      previewReducedManifest(null, adminId),
      /Invalid support status manifest/,
    );
  });

  it('rejects malformed and unknown previews safely', async () => {
    await assert.rejects(applyPreview('invalid', adminId), /Invalid support/);
    await assert.rejects(
      applyPreview(new mongoose.Types.ObjectId().toString(), adminId),
      /not found/,
    );
  });
});
