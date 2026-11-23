import type { SupportStatusImportPreviewRecord } from '../../server/models/support-status-import-preview.server.model.mts';
import assert from 'node:assert/strict';
import mongoose, { type Types } from 'mongoose';
import sinon from 'sinon';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
import emailService from '../../../core/server/services/email.server.service.mts';
import { extractTicketStatusItem } from '../../../../bin/db-maintenance/prepare-zendesk-statuses.mts';
import {
  applyPreview,
  previewReducedManifest,
} from '../../server/services/status-import.server.service.mts';
import {
  normaliseSupportImportMessage,
  normaliseStoredSupportCategory,
  supportRequestFingerprint,
  supportImportMessageHash,
  supportImportSenderHash,
  supportRequestImportFingerprints,
} from '../../server/services/support-fingerprint.server.service.mts';

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
const PreviewModel = mongoose.model<SupportStatusImportPreviewRecord>(
  'SupportStatusImportPreview',
);

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

  it('suggests formatting-equivalent v2 candidates without applying them implicitly', async () => {
    const localMessage = 'A fictional request & needs help.';
    const sourceMessage = 'A fictional request  & needs help.';
    assert.equal(
      supportImportMessageHash(localMessage),
      supportImportMessageHash(sourceMessage),
    );
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $set: { message: localMessage } },
    );
    const competingRequest = await SupportRequest.create({
      ...input,
      message: localMessage,
      status: 'open',
      sent: supportRequest.sent,
    });
    const source = {
      version: 2,
      exportedAt: '2025-01-01T00:00:00.000Z',
      items: [
        {
          zendeskTicketId: 891,
          status: 'pending',
          updatedAt: '2025-01-01T00:00:00.000Z',
          fingerprint: supportRequestFingerprint({
            ...input,
            message: sourceMessage,
          }),
          evidence: {
            senderHash: supportImportSenderHash(input.email),
            category: input.category,
            submittedAt: supportRequest.sent.toISOString(),
            normalisedMessageHash: supportImportMessageHash(sourceMessage),
          },
        },
      ],
    };
    const preview = await previewReducedManifest(source, adminId);
    assert.equal(preview.counts.eligible, 0);
    assert.equal(preview.counts.suggested, 1);
    assert.equal(preview.matchReviews.length, 1);
    assert.equal(preview.matchReviews[0]?.candidates.length, 2);
    assert.equal(
      preview.matchReviews[0]?.candidates[0]?.competingCandidateCount,
      2,
    );
    assert.equal(
      preview.matchReviews[0]?.candidates[0]?.reason.includes(
        'within the selected window',
      ),
      true,
    );
    assert.equal(preview.matchReviews[0]?.candidates[0]?.email, input.email);
    assert.equal(JSON.stringify(preview).includes(localMessage), false);

    const withoutSelection = await applyPreview(preview.previewId, adminId);
    assert.deepEqual(withoutSelection, {
      applied: 0,
      alreadyApplied: 0,
      skipped: 1,
    });
    const updated = await SupportRequest.findById(supportRequest._id).lean();
    assert.equal(updated?.status, 'open');
    assert.equal(updated?.zendeskTicketId, undefined);

    const secondPreview = await previewReducedManifest(source, adminId);
    assert.deepEqual(
      await applyPreview(secondPreview.previewId, adminId, [
        {
          zendeskTicketId: 891,
          requestId: String(competingRequest._id),
        },
      ]),
      { applied: 1, alreadyApplied: 0, skipped: 0 },
    );
    assert.equal(
      (await SupportRequest.findById(competingRequest._id).lean())
        ?.zendeskTicketId,
      891,
    );
  });

  it('stores and enforces a wider matching window through apply', async () => {
    const localMessage = 'A fictional request & needs help.';
    const sourceMessage = 'A fictional request  & needs help.';
    const submittedAt = new Date(supportRequest.sent.getTime() - 2 * 60_000);
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      {
        $set: {
          message: localMessage,
          username: 'fictional-name',
          subject: 'Fictional subject',
        },
      },
    );
    const source = {
      version: 2,
      exportedAt: '2025-01-01T00:00:00.000Z',
      items: [
        {
          zendeskTicketId: 892,
          status: 'pending',
          updatedAt: '2025-01-01T00:00:00.000Z',
          fingerprint: supportRequestFingerprint({
            ...input,
            message: sourceMessage,
          }),
          evidence: {
            senderHash: supportImportSenderHash(input.email),
            category: input.category,
            submittedAt: submittedAt.toISOString(),
            normalisedMessageHash: supportImportMessageHash(sourceMessage),
          },
        },
      ],
    };
    const preview = await previewReducedManifest(source, adminId, '5');
    assert.equal(preview.matchingWindowMinutes, 5);
    const candidate = preview.matchReviews[0]?.candidates[0];
    assert.equal(candidate?.senderUsername, 'fictional-name');
    assert.equal(candidate?.email, input.email);
    assert.equal(candidate?.subject, 'Fictional subject');
    const storedPreview = await PreviewModel.findById(preview.previewId).lean();
    assert.equal(JSON.stringify(storedPreview).includes(input.email), false);
    assert.equal(
      JSON.stringify(storedPreview).includes('fictional-name'),
      false,
    );
    const previewAudit = await AuditLog.findOne({
      'params.previewId': preview.previewId,
    }).lean();
    assert.equal(JSON.stringify(previewAudit).includes(input.email), false);
    assert.equal(
      JSON.stringify(previewAudit).includes('Fictional subject'),
      false,
    );
    assert.deepEqual(
      await applyPreview(preview.previewId, adminId, [
        { zendeskTicketId: 892, requestId: String(supportRequest._id) },
      ]),
      { applied: 1, alreadyApplied: 0, skipped: 0 },
    );
    assert.equal(
      (await PreviewModel.findById(preview.previewId).lean())
        ?.matchingWindowMinutes,
      5,
    );
  });

  it('rejects non-canonical matching windows and defaults legacy previews to one minute', async () => {
    for (const invalid of [
      '',
      '01',
      '1.0',
      '+1',
      ' 1',
      '61',
      '0',
      '1x',
      ['1'],
      null,
      true,
    ]) {
      await assert.rejects(
        previewReducedManifest(manifest(), adminId, invalid),
        /Matching window must be an integer/,
      );
    }
    const defaultPreview = await previewReducedManifest(manifest(), adminId);
    assert.equal(defaultPreview.matchingWindowMinutes, 1);
    await PreviewModel.updateOne(
      { _id: defaultPreview.previewId },
      { $unset: { matchingWindowMinutes: 1 } },
    );
    assert.equal(
      (await PreviewModel.findById(defaultPreview.previewId).lean())
        ?.matchingWindowMinutes,
      undefined,
    );
  });

  it('uses the one-minute guard when applying a legacy preview without a stored window', async () => {
    const localMessage = 'A fictional request & needs help.';
    const sourceMessage = 'A fictional request  & needs help.';
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $set: { message: localMessage } },
    );
    const source = {
      version: 2,
      exportedAt: '2025-01-01T00:00:00.000Z',
      items: [
        {
          zendeskTicketId: 893,
          status: 'pending',
          updatedAt: '2025-01-01T00:00:00.000Z',
          fingerprint: supportRequestFingerprint({
            ...input,
            message: sourceMessage,
          }),
          evidence: {
            senderHash: supportImportSenderHash(input.email),
            category: input.category,
            submittedAt: supportRequest.sent.toISOString(),
            normalisedMessageHash: supportImportMessageHash(sourceMessage),
          },
        },
      ],
    };
    const preview = await previewReducedManifest(source, adminId);
    await PreviewModel.updateOne(
      { _id: preview.previewId },
      { $unset: { matchingWindowMinutes: 1 } },
    );
    assert.deepEqual(
      await applyPreview(preview.previewId, adminId, [
        { zendeskTicketId: 893, requestId: String(supportRequest._id) },
      ]),
      { applied: 1, alreadyApplied: 0, skipped: 0 },
    );
  });

  it('does not suggest when sender, category, message, time, or submission timestamp differs', async () => {
    const localTime = supportRequest.sent.toISOString();
    const baseEvidence = {
      senderHash: supportImportSenderHash(input.email),
      category: input.category,
      submittedAt: localTime as string | null,
      normalisedMessageHash: supportImportMessageHash(input.message),
    };
    const alternatives = [
      { ...baseEvidence, senderHash: 'f'.repeat(64) },
      { ...baseEvidence, category: 'account' },
      { ...baseEvidence, normalisedMessageHash: 'e'.repeat(64) },
      {
        ...baseEvidence,
        submittedAt: new Date(
          new Date(localTime).getTime() + 61_000,
        ).toISOString(),
      },
      { ...baseEvidence, submittedAt: null },
    ];

    for (const [index, evidence] of alternatives.entries()) {
      const source = {
        version: 2,
        exportedAt: '2025-01-01T00:00:00.000Z',
        items: [
          {
            zendeskTicketId: 910 + index,
            status: 'pending',
            updatedAt: '2025-01-01T00:00:00.000Z',
            fingerprint: supportRequestFingerprint({
              ...input,
              message: `Fictional unmatched source ${index}.`,
            }),
            evidence,
          },
        ],
      };
      const preview = await previewReducedManifest(source, adminId);
      assert.equal(preview.counts.suggested, 0);
      assert.equal(preview.matchReviews.length, 0);
      assert.equal(preview.counts.skippedByReason['no-match'], 1);
    }
  });

  it('ignores requests without a valid category or sent timestamp and respects an existing same-ticket link', async () => {
    const sourceFor = (zendeskTicketId: number) => ({
      version: 2,
      exportedAt: '2025-01-01T00:00:00.000Z',
      items: [
        {
          zendeskTicketId,
          status: 'pending',
          updatedAt: '2025-01-01T00:00:00.000Z',
          fingerprint: supportRequestFingerprint({
            ...input,
            message: `Different fictional source ${zendeskTicketId}.`,
          }),
          evidence: {
            senderHash: supportImportSenderHash(input.email),
            category: input.category,
            submittedAt: supportRequest.sent.toISOString(),
            normalisedMessageHash: supportImportMessageHash(input.message),
          },
        },
      ],
    });

    await SupportRequest.collection.updateOne(
      { _id: supportRequest._id },
      { $unset: { sent: '' } },
    );
    const noSent = await previewReducedManifest(sourceFor(894), adminId);
    assert.equal(noSent.counts.suggested, 0);
    assert.equal(noSent.counts.skippedByReason['no-match'], 1);

    await SupportRequest.collection.updateOne(
      { _id: supportRequest._id },
      { $set: { sent: supportRequest.sent, category: 'invalid-category' } },
    );
    const noCategory = await previewReducedManifest(sourceFor(894), adminId);
    assert.equal(noCategory.counts.suggested, 0);
    assert.equal(noCategory.counts.skippedByReason['no-match'], 1);

    await SupportRequest.collection.updateOne(
      { _id: supportRequest._id },
      { $set: { category: 'other', zendeskTicketId: 894 } },
    );
    const sameTicket = await previewReducedManifest(sourceFor(894), adminId);
    assert.equal(sameTicket.counts.suggested, 1);
    assert.equal(sameTicket.matchReviews[0]?.candidates.length, 1);
  });

  it('rejects duplicate, exact-overlap, and unknown explicit selections', async () => {
    const exactPreview = await previewReducedManifest(manifest(), adminId);
    await assert.rejects(
      applyPreview(exactPreview.previewId, adminId, [
        { zendeskTicketId: 789, requestId: String(supportRequest._id) },
      ]),
      /one-to-one/,
    );
    await assert.rejects(
      applyPreview(exactPreview.previewId, adminId, [
        { zendeskTicketId: 789, requestId: 'bad' },
      ] as never),
      /Invalid support status selection/,
    );

    const localMessage = 'A fictional request & needs help.';
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $set: { message: localMessage } },
    );
    const source = {
      version: 2,
      exportedAt: '2025-01-01T00:00:00.000Z',
      items: [
        {
          zendeskTicketId: 892,
          status: 'pending',
          updatedAt: '2025-01-01T00:00:00.000Z',
          fingerprint: supportRequestFingerprint({
            ...input,
            message: 'Different source text.',
          }),
          evidence: {
            senderHash: supportImportSenderHash(input.email),
            category: input.category,
            submittedAt: supportRequest.sent.toISOString(),
            normalisedMessageHash: supportImportMessageHash(localMessage),
          },
        },
      ],
    };
    const preview = await previewReducedManifest(source, adminId);
    await assert.rejects(
      applyPreview(preview.previewId, adminId, [
        { zendeskTicketId: 892, requestId: String(supportRequest._id) },
        { zendeskTicketId: 892, requestId: String(supportRequest._id) },
      ]),
      /one-to-one/,
    );
    await assert.rejects(
      applyPreview(preview.previewId, adminId, [
        {
          zendeskTicketId: 892,
          requestId: new mongoose.Types.ObjectId().toString(),
        },
      ]),
      /not a suggested match/,
    );
  });

  it('rechecks suggested evidence and ticket ownership during apply', async () => {
    const localMessage = 'A fictional request & needs help.';
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $set: { message: localMessage } },
    );
    const source = {
      version: 2,
      exportedAt: '2025-01-01T00:00:00.000Z',
      items: [
        {
          zendeskTicketId: 893,
          status: 'pending',
          updatedAt: '2025-01-01T00:00:00.000Z',
          fingerprint: supportRequestFingerprint({
            ...input,
            message: 'Different source text.',
          }),
          evidence: {
            senderHash: supportImportSenderHash(input.email),
            category: input.category,
            submittedAt: supportRequest.sent.toISOString(),
            normalisedMessageHash: supportImportMessageHash(localMessage),
          },
        },
      ],
    };
    const stalePreview = await previewReducedManifest(source, adminId);
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $set: { sent: new Date(supportRequest.sent.getTime() + 61_000) } },
    );
    assert.deepEqual(
      await applyPreview(stalePreview.previewId, adminId, [
        { zendeskTicketId: 893, requestId: String(supportRequest._id) },
      ]),
      { applied: 0, alreadyApplied: 0, skipped: 1 },
    );

    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      {
        $set: {
          sent: supportRequest.sent,
          lastActivityAt: new Date('2025-01-02T00:00:00.000Z'),
        },
      },
    );
    const newerActivityPreview = await previewReducedManifest(source, adminId);
    assert.deepEqual(
      await applyPreview(newerActivityPreview.previewId, adminId, [
        { zendeskTicketId: 893, requestId: String(supportRequest._id) },
      ]),
      { applied: 0, alreadyApplied: 0, skipped: 1 },
    );
    await SupportRequest.updateOne(
      { _id: supportRequest._id },
      { $unset: { lastActivityAt: '' } },
    );
    const conflictPreview = await previewReducedManifest(source, adminId);
    await SupportRequest.create({
      ...input,
      status: 'open',
      sent: new Date('2024-02-01T00:00:00.000Z'),
      zendeskTicketId: 893,
    });
    assert.deepEqual(
      await applyPreview(conflictPreview.previewId, adminId, [
        { zendeskTicketId: 893, requestId: String(supportRequest._id) },
      ]),
      { applied: 0, alreadyApplied: 0, skipped: 1 },
    );
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

  it('normalises only conservative message formatting for suggestions', () => {
    assert.equal(
      normaliseSupportImportMessage(
        ' Line  \r\n\twrap \n\n\n&amp; &lt; &gt; &quot; &#39; &apos; &#65; &#x42; &unknown; ',
      ),
      `Line\nwrap\n\n& < > " ' ' A B &unknown;`,
    );
    assert.equal(
      normaliseSupportImportMessage('See www.example.org/help.'),
      normaliseSupportImportMessage('See http://www.example.org/help.'),
    );
    assert.equal(
      normaliseSupportImportMessage('Keep <script> literally.'),
      'Keep <script> literally.',
    );
    assert.equal(
      normaliseSupportImportMessage('Keep &#99999999; literally.'),
      'Keep &#99999999; literally.',
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
        $unset: {
          status: '',
          statusRevision: '',
          sent: '',
          statusChangedAt: '',
        },
      },
    );
    const preview = await previewReducedManifest(manifest(), adminId);
    assert.equal(preview.counts.eligible, 1);
    assert.equal(preview.changes[0]?.currentStatus, 'unconfirmed');
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
      previewReducedManifest(
        {
          version: 2,
          exportedAt: '2025-01-01T00:00:00.000Z',
          items: [
            {
              ...manifest().items[0],
              evidence: {
                senderHash: 'invalid',
                category: input.category,
                submittedAt: null,
                normalisedMessageHash: supportImportMessageHash(input.message),
              },
            },
          ],
        },
        adminId,
      ),
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

describe('conservative support status import: behaviour guards', () => {
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

  const SupportRequest =
    mongoose.model<SupportRequestFixture>('SupportRequest');
  const AuditLog = mongoose.model<AuditFixture>('AuditLog');
  const User = mongoose.model('User');

  const badRequest = (message: string) => ({ status: 400, message });
  const MANIFEST_ERROR = badRequest('Invalid support status manifest.');
  const ONE_TO_ONE = badRequest(
    'Support status selections must be one-to-one.',
  );
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

  const outcome = (
    applied: number,
    alreadyApplied: number,
    skipped: number,
  ) => ({
    applied,
    alreadyApplied,
    skipped,
  });
  const counts = (
    [total, eligible, suggested, alreadyApplied, skipped]: number[],
    skippedByReason: Rec = {},
  ) => ({
    total,
    eligible,
    suggested,
    alreadyApplied,
    skipped,
    skippedByReason,
  });
  const set = (field: string, value: unknown) => ({ $set: { [field]: value } });
  const unset = (field: string) => ({ $unset: { [field]: '' } });

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
