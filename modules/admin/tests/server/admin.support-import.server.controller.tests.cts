import type { Types } from 'mongoose';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const controller: typeof import('../../server/controllers/admin.support-import.server.controller.mts') = require('../../server/controllers/admin.support-import.server.controller.mts');
const {
  supportImportMessageHash,
  supportImportSenderHash,
  supportRequestFingerprint,
}: typeof import('../../../support/server/services/support-fingerprint.server.service.mts') = require('../../../support/server/services/support-fingerprint.server.service.mts');

interface SupportRequestFixture {
  category: string;
  email: string;
  message: string;
  status: string;
  sent: Date;
}

interface ResponseCapture {
  statusCode: number;
  body?: unknown;
  status(code: number): ResponseCapture;
  send(body: unknown): ResponseCapture;
}

const SupportRequest = mongoose.model<SupportRequestFixture>('SupportRequest');
const AuditLog = mongoose.model('AuditLog');

function captureResponse(): ResponseCapture {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

describe('admin support status import controller', () => {
  let adminId: Types.ObjectId;
  let ordinaryUserId: Types.ObjectId;
  const identity = {
    category: 'other' as const,
    email: 'visitor@example.org',
    message: 'A fictional request for help.',
  };

  beforeEach(async () => {
    const admins = utils.generateUsersWithSharedPassword(1);
    admins[0]!.roles = ['user', 'admin'];
    const [admin] = await utils.saveUsers(admins);
    adminId = admin!._id;
    const ordinary = utils.generateUsersWithSharedPassword(1);
    const [user] = await utils.saveUsers(ordinary);
    ordinaryUserId = user!._id;
    await SupportRequest.create({
      ...identity,
      status: 'open',
      sent: new Date('2024-01-01T00:00:00.000Z'),
    });
  });

  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });

  function manifest() {
    return {
      version: 1,
      exportedAt: '2025-01-01T00:00:00.000Z',
      items: [
        {
          zendeskTicketId: 789,
          status: 'pending',
          updatedAt: '2025-01-01T00:00:00.000Z',
          fingerprint: supportRequestFingerprint(identity),
        },
      ],
    };
  }

  async function preview(
    actorId: Types.ObjectId | string,
    body: unknown,
    matchingWindowMinutes?: unknown,
  ) {
    const response = captureResponse();
    await controller.preview(
      {
        body,
        query:
          matchingWindowMinutes === undefined ? {} : { matchingWindowMinutes },
        user: { _id: actorId },
      } as never,
      response as never,
    );
    return response;
  }

  async function apply(actorId: Types.ObjectId | string, body: unknown) {
    const response = captureResponse();
    await controller.apply(
      { body, user: { _id: actorId } } as never,
      response as never,
    );
    return response;
  }

  it('returns a safe administrator preview and applies its reviewed changes', async () => {
    const previewResponse = await preview(adminId, manifest());
    assert.equal(previewResponse.statusCode, 200);
    const previewBody = previewResponse.body as {
      previewId: string;
      counts: { eligible: number };
      changes: Array<{ zendeskTicketId: number }>;
    };
    assert.equal(previewBody.counts.eligible, 1);
    assert.equal(previewBody.changes[0]?.zendeskTicketId, 789);
    assert.equal(JSON.stringify(previewBody).includes(identity.email), false);
    assert.equal(JSON.stringify(previewBody).includes(identity.message), false);

    const applyResponse = await apply(adminId, {
      previewId: previewBody.previewId,
    });
    assert.equal(applyResponse.statusCode, 200);
    assert.deepEqual(applyResponse.body, {
      applied: 1,
      alreadyApplied: 0,
      skipped: 0,
    });
  });

  it('rejects non-admins and any upload containing raw export fields', async () => {
    const denied = await preview(ordinaryUserId, manifest());
    assert.equal(denied.statusCode, 403);
    assert.deepEqual(denied.body, {
      message: 'An administrator must import support statuses.',
    });

    const rawExport = { ...manifest(), description: 'Fictional raw text.' };
    const invalid = await preview(adminId, rawExport);
    assert.equal(invalid.statusCode, 400);
    assert.deepEqual(invalid.body, {
      message: 'Invalid support status manifest.',
    });
  });

  it('validates apply input and hides internal server error detail', async () => {
    const invalidShape = await apply(adminId, []);
    assert.equal(invalidShape.statusCode, 400);
    assert.deepEqual(invalidShape.body, {
      message: 'Invalid support status preview.',
    });

    const invalidId = await apply(adminId, { previewId: 'bad-id' });
    assert.equal(invalidId.statusCode, 400);
    assert.deepEqual(invalidId.body, {
      message: 'Invalid support status preview.',
    });

    for (const invalidBody of [
      null,
      'not an object',
      { selectedMatches: [] },
      { previewId: 123 },
      { previewId: 'preview', unexpected: true },
      { previewId: 'preview', matchingWindowMinutes: 60 },
      { previewId: 'preview', selectedMatches: null },
    ]) {
      const response = await apply(adminId, invalidBody);
      assert.equal(response.statusCode, 400);
      assert.deepEqual(response.body, {
        message: 'Invalid support status preview.',
      });
    }

    const invalidSelections = [
      'not an object',
      null,
      [],
      {},
      { requestId: 'a'.repeat(24) },
      { ticketId: 789, requestId: 'a'.repeat(24) },
      { zendeskTicketId: '789', requestId: 'a'.repeat(24) },
      {
        zendeskTicketId: Number.MAX_SAFE_INTEGER + 1,
        requestId: 'a'.repeat(24),
      },
      { zendeskTicketId: 0, requestId: 'a'.repeat(24) },
      { zendeskTicketId: 789, other: 'a'.repeat(24) },
      { zendeskTicketId: 789, requestId: 123 },
      { zendeskTicketId: 789, requestId: 'not-an-id' },
    ];
    for (const selection of invalidSelections) {
      const response = await apply(adminId, {
        previewId: 'valid-looking-preview',
        selectedMatches: [selection],
      });
      assert.equal(response.statusCode, 400);
      assert.deepEqual(response.body, {
        message: 'Invalid support status preview.',
      });
    }

    sinon.stub(AuditLog.prototype, 'save').rejects(new Error('private detail'));
    const failedAudit = await preview(adminId, manifest());
    assert.equal(failedAudit.statusCode, 500);
    assert.deepEqual(failedAudit.body, {
      message: 'Unable to process support status import.',
    });
  });

  it('accepts a valid explicit candidate selection through the apply endpoint', async () => {
    const localRequest = await SupportRequest.findOne(identity).lean();
    assert.ok(localRequest);
    const sourceMessage = 'A fictional  request for help.';
    const sourceManifest = {
      version: 2,
      exportedAt: '2025-01-01T00:00:00.000Z',
      items: [
        {
          zendeskTicketId: 790,
          status: 'pending',
          updatedAt: '2025-01-01T00:00:00.000Z',
          fingerprint: supportRequestFingerprint({
            ...identity,
            message: sourceMessage,
          }),
          evidence: {
            senderHash: supportImportSenderHash(identity.email),
            category: identity.category,
            submittedAt: localRequest.sent.toISOString(),
            normalisedMessageHash: supportImportMessageHash(sourceMessage),
          },
        },
      ],
    };
    const previewResponse = await preview(adminId, sourceManifest);
    assert.equal(previewResponse.statusCode, 200);
    const previewBody = previewResponse.body as {
      previewId: string;
      matchReviews: Array<{ candidates: Array<{ requestId: string }> }>;
    };
    const candidateId = previewBody.matchReviews[0]?.candidates[0]?.requestId;
    assert.equal(candidateId, String(localRequest._id));

    const response = await apply(adminId, {
      previewId: previewBody.previewId,
      selectedMatches: [{ zendeskTicketId: 790, requestId: candidateId }],
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      applied: 1,
      alreadyApplied: 0,
      skipped: 0,
    });
  });

  it('passes a canonical matching window and rejects malformed query values', async () => {
    const accepted = await preview(adminId, manifest(), '60');
    assert.equal(accepted.statusCode, 200);
    assert.equal(
      (accepted.body as { matchingWindowMinutes: number })
        .matchingWindowMinutes,
      60,
    );
    for (const invalid of ['', '01', '1.5', '61', ['5'], 5]) {
      const response = await preview(adminId, manifest(), invalid);
      assert.equal(response.statusCode, 400);
      assert.deepEqual(response.body, {
        message: 'Matching window must be an integer from 1 to 60 minutes.',
      });
    }
  });

  it('maps unexpected actor lookup errors to a generic response', async () => {
    const response = await preview('invalid-object-id', manifest());
    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, {
      message: 'Unable to process support status import.',
    });
  });
});
