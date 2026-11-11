const request: typeof import('supertest') = require('supertest');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const express: typeof import('express') = require('express');
const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const adminPolicy: typeof import('../../server/policies/admin.server.policy.mts').default = require('../../server/policies/admin.server.policy.mts');
const registerEmailReplyRoutes: typeof import('../../server/routes/admin.email-replies.server.routes.mts').default =
  require('../../server/routes/admin.email-replies.server.routes.mts').default;

const settings = {
  TRUSTROOTS_EMAIL_REPLIES_JMAP_SESSION_URL:
    'https://mail.example.test/jmap/session',
  TRUSTROOTS_EMAIL_REPLIES_JMAP_ACCESS_TOKEN: 'fictional-mailbox-secret',
  TRUSTROOTS_EMAIL_REPLIES_JMAP_ACCOUNT_ID: 'account-1',
  TRUSTROOTS_EMAIL_REPLIES_JMAP_MAILBOX_ID: 'mailbox-1',
};
const route = '/api/admin/email-replies';

describe('admin email reply preview', () => {
  let fetchStub: import('sinon').SinonStub;
  const keys = Object.keys(settings);
  const previous = keys.map(key => process.env[key]);
  const originalHttps = config.https;

  adminPolicy.invokeRolesPolicies();

  beforeEach(() => {
    Object.assign(process.env, settings);
    fetchStub = sinon.stub(globalThis, 'fetch');
  });

  afterEach(() => {
    config.https = originalHttps;
    sinon.restore();
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  });

  function readAs(role?: string) {
    const app = express();
    app.use((req, _res, next) => {
      if (role) Object.assign(req, { user: { roles: ['user', role] } });
      next();
    });
    registerEmailReplyRoutes(app);
    return request(app).get(route);
  }

  it('checks administrator access before reading the mailbox', async () => {
    await readAs().expect(403);
    await readAs('support-team').expect(403);
    assert.equal(fetchStub.callCount, 0);
  });

  it('reports incomplete configuration and hides provider errors', async () => {
    for (const key of keys) {
      delete process.env[key];
      await readAs('admin').expect('Cache-Control', 'no-store').expect(200, {
        status: 'unconfigured',
      });
      Object.assign(process.env, settings);
    }
    assert.equal(fetchStub.callCount, 0);
    fetchStub.rejects(
      new Error(settings.TRUSTROOTS_EMAIL_REPLIES_JMAP_ACCESS_TOKEN),
    );
    await readAs('admin').expect('Cache-Control', 'no-store').expect(503, {
      message: 'Could not read the reply mailbox.',
    });
  });

  for (const https of [false, true]) {
    it(`extracts text and finds matching links with HTTPS ${https}`, async () => {
      config.https = https;
      const origin = `${config.https ? 'https' : 'http'}://${config.domain}`;
      const replies = [
        [
          'See you there!',
          `> ${origin}/messages/member_one`,
          `> ${origin}/messages/member_one/?source=email`,
          `> ${origin}/profile/another_member`,
          `> ${origin}/other/messages/another_member`,
          `> ${origin}/messages/another_member/extra`,
          '> https://elsewhere.example.test/messages/another_member',
          '> https://[',
          '> hello+private-token@example.test fictional-mailbox-secret',
        ].join('\n'),
        [
          'Here is my reply.',
          `> ${origin}/messages/member_one ${origin}/messages/member_two`,
        ].join('\n'),
        '> Quoted text only',
        'An automated response.',
        'This text was truncated.',
        'é'.repeat(20_001),
        'é'.repeat(10_000),
      ];
      const ids = replies.map((_, index) => String(index));
      fetchStub.onFirstCall().resolves(
        Response.json({
          apiUrl: 'https://mail.example.test/jmap/',
          capabilities: {
            'urn:ietf:params:jmap:core': {},
            'urn:ietf:params:jmap:mail': {},
          },
        }),
      );
      fetchStub.onSecondCall().resolves(
        Response.json({
          methodResponses: [['Email/query', { ids }, 'query']],
        }),
      );
      fetchStub.onThirdCall().resolves(
        Response.json({
          methodResponses: [
            [
              'Email/get',
              {
                list: replies.map((value, index) => ({
                  id: ids[index],
                  from:
                    index === 2
                      ? [
                          { email: 'member@example.test' },
                          { email: 'other@example.test' },
                        ]
                      : [{ email: 'member@example.test' }],
                  to: [{ email: 'hello+private-token@example.test' }],
                  textBody: [{ partId: 'plain' }],
                  bodyValues: { plain: { value, isTruncated: index === 4 } },
                  'header:Auto-Submitted:asText': [
                    null,
                    ' No ',
                    'no',
                    'auto-replied',
                    'no',
                    'no',
                  ][index],
                })),
                notFound: [],
              },
              'get',
            ],
          ],
        }),
      );

      const response = await readAs('admin')
        .expect('Cache-Control', 'no-store')
        .expect(200);
      assert.equal(response.body.status, 'preview');
      assert.ok(Number.isFinite(Date.parse(response.body.checkedAt)));
      assert.doesNotMatch(
        response.text,
        /private-token|fictional-mailbox-secret/,
      );
      assert.equal(response.body.replies[0].sender, 'member@example.test');
      assert.equal(
        response.body.replies[2].sender,
        'member@example.test, other@example.test',
      );
      assert.deepEqual(response.body.replies[0].recipients, [
        'hello+[redacted]@example.test',
      ]);
      assert.equal(response.body.replies[0].extractedText, 'See you there!');
      assert.equal(response.body.replies[5].extractedText.length, 20_000);
      assert.equal(response.body.replies[5].sourceText.length, 20_000);
      assert.match(
        response.body.replies[0].sourceText,
        /> .*\/messages\/member_one/,
      );
      assert.ok(
        response.body.replies[0].sourceText.includes(
          'hello+[redacted]@example.test [redacted]',
        ),
      );
      assert.deepEqual(response.body.replies[0].candidates, ['member_one']);
      assert.deepEqual(response.body.replies[1].candidates, [
        'member_one',
        'member_two',
      ]);
      assert.deepEqual(
        response.body.replies.map(
          (reply: { matching: string }) => reply.matching,
        ),
        [
          'candidate',
          'ambiguous',
          'unmatched',
          'unmatched',
          'unmatched',
          'unmatched',
          'unmatched',
        ],
      );
      assert.deepEqual(
        response.body.replies.map(
          (reply: { parseResult: string }) => reply.parseResult,
        ),
        [
          'Extracted',
          'Extracted',
          'Empty',
          'Automated',
          'Incomplete',
          'Too large',
          'Extracted',
        ],
      );
      assert.equal(fetchStub.callCount, 3);
      assert.deepEqual(
        fetchStub
          .getCalls()
          .slice(1)
          .map(call => JSON.parse(call.args[1].body).methodCalls[0][0]),
        ['Email/query', 'Email/get'],
      );
    });
  }
});
