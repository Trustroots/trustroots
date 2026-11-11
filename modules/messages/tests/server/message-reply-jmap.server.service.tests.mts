import assert from 'node:assert/strict';
import {
  acknowledgeReplyEmail,
  fetchReplyEmails,
  type JmapOptions,
} from '../../server/services/message-reply-jmap.server.service.mts';

const SESSION = {
  apiUrl: 'https://mail.example.test/jmap/',
  capabilities: {
    'urn:ietf:params:jmap:core': {},
    'urn:ietf:params:jmap:mail': {},
  },
};

function jsonResponse(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), init);
}

function methodResponse(
  method: string,
  result: Record<string, unknown>,
  callId: string,
): Response {
  return jsonResponse({ methodResponses: [[method, result, callId]] });
}

function client(responses: Response[]) {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    const response = responses.shift();
    assert.ok(response, 'unexpected fetch request');
    return response;
  };
  const options: JmapOptions = {
    sessionUrl: 'https://mail.example.test/jmap/session',
    accessToken: 'fictional-token',
    accountId: 'fictional-account',
    fetchImpl,
  };
  return { options, requests };
}

describe('JMAP message reply service', () => {
  it('fetches unprocessed messages and returns plain text and headers', async () => {
    const { options, requests } = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'], total: 1 }, 'query'),
      methodResponse(
        'Email/get',
        {
          list: [
            {
              id: 'email-1',
              from: [{ name: 'Example Sender', email: 'sender@example.test' }],
              to: [{ email: 'inbox@example.test' }],
              messageId: ['<reply@example.test>'],
              textBody: [{ partId: 'plain-1' }, { partId: 'plain-2' }],
              bodyValues: {
                'plain-1': { value: 'First part', isTruncated: false },
                'plain-2': { value: 'Second part', isTruncated: true },
                html: { value: '<p>Ignore HTML</p>' },
              },
              'header:Auto-Submitted:asText': 'no',
            },
          ],
          notFound: [],
        },
        'get',
      ),
    ]);

    const emails = await fetchReplyEmails({ ...options, mailboxId: 'inbox-1' });
    assert.deepEqual(emails, [
      {
        id: 'email-1',
        from: ['sender@example.test'],
        to: ['inbox@example.test'],
        messageId: '<reply@example.test>',
        autoSubmitted: 'no',
        text: 'First part\nSecond part',
        truncated: true,
      },
    ]);
    assert.equal(requests.length, 3);
    assert.equal(requests[0]!.init?.method, 'GET');
    assert.equal(requests[0]!.init?.redirect, 'error');
    assert.equal(
      (requests[0]!.init?.headers as Record<string, string>).Authorization,
      'Bearer fictional-token',
    );
    const queryBody = JSON.parse(String(requests[1]!.init?.body));
    assert.deepEqual(queryBody.methodCalls[0][1].filter, {
      inMailbox: 'inbox-1',
      notKeyword: 'trustrootsProcessed',
    });
    assert.equal(queryBody.methodCalls[0][1].limit, 20);
    assert.equal(queryBody.methodCalls[0][1].sort[0].isAscending, true);
    const getBody = JSON.parse(String(requests[2]!.init?.body));
    assert.equal(getBody.methodCalls[0][1].fetchTextBodyValues, true);
    assert.equal(getBody.methodCalls[0][1].maxBodyValueBytes, 20_000);
  });

  it('returns an empty list without requesting Email/get when there are no matches', async () => {
    const { options, requests } = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: [] }, 'query'),
    ]);
    assert.deepEqual(
      await fetchReplyEmails({ ...options, mailboxId: 'inbox-1' }),
      [],
    );
    assert.equal(requests.length, 2);
  });

  it('uses the built-in fetch when no fetch implementation is supplied', async () => {
    const originalFetch = globalThis.fetch;
    const responses = [
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: [] }, 'query'),
    ];
    globalThis.fetch = async () => {
      const response = responses.shift();
      assert.ok(response);
      return response;
    };
    try {
      const options = { ...client([]).options };
      delete options.fetchImpl;
      assert.deepEqual(
        await fetchReplyEmails({ ...options, mailboxId: 'inbox-1' }),
        [],
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('marks absent or malformed body values unusable and checks returned email IDs', async () => {
    const missingBody = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse(
        'Email/get',
        {
          list: [
            {
              id: 'email-1',
              from: [{ email: 'sender@example.test' }],
              textBody: [{ partId: 'plain-1' }, { partId: 'plain-2' }],
              bodyValues: {
                'plain-1': { value: 'Partial' },
                'plain-2': { value: 'Bad encoding', isEncodingProblem: true },
              },
            },
          ],
        },
        'get',
      ),
    ]);
    const [email] = await fetchReplyEmails({
      ...missingBody.options,
      mailboxId: 'inbox-1',
    });
    assert.equal(email?.truncated, true);

    const missingPartId = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse(
        'Email/get',
        { list: [{ id: 'email-1', textBody: [{}] }] },
        'get',
      ),
    ]);
    const [emailWithoutPartId] = await fetchReplyEmails({
      ...missingPartId.options,
      mailboxId: 'inbox-1',
    });
    assert.equal(emailWithoutPartId?.truncated, true);

    const missingValue = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse(
        'Email/get',
        {
          list: [
            {
              id: 'email-1',
              from: [{ email: 'sender@example.test' }],
              textBody: [{ partId: 'not-returned' }],
            },
          ],
        },
        'get',
      ),
    ]);
    const [emailWithoutValue] = await fetchReplyEmails({
      ...missingValue.options,
      mailboxId: 'inbox-1',
    });
    assert.equal(emailWithoutValue?.text, '');
    assert.equal(emailWithoutValue?.truncated, true);

    const malformedSender = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse(
        'Email/get',
        { list: [{ id: 'email-1', from: [{ name: 'No address' }] }] },
        'get',
      ),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...malformedSender.options, mailboxId: 'inbox-1' }),
      /invalid email address/,
    );

    const extraRecord = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse('Email/get', { list: [{ id: 'other-email' }] }, 'get'),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...extraRecord.options, mailboxId: 'inbox-1' }),
      /ids do not match/,
    );

    const invalidList = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse('Email/get', { list: null }, 'get'),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...invalidList.options, mailboxId: 'inbox-1' }),
      /invalid list/,
    );
  });

  it('uses empty values for missing optional message fields', async () => {
    const { options } = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse('Email/get', { list: [{ id: 'email-1' }] }, 'get'),
    ]);
    assert.deepEqual(
      await fetchReplyEmails({ ...options, mailboxId: 'inbox-1' }),
      [
        {
          id: 'email-1',
          from: [],
          to: [],
          messageId: null,
          autoSubmitted: null,
          text: '',
          truncated: true,
        },
      ],
    );
  });

  it('rejects invalid URLs and missing credentials', async () => {
    const { options } = client([]);
    await assert.rejects(
      fetchReplyEmails({
        ...options,
        sessionUrl: 'https://[invalid/session',
        mailboxId: 'inbox-1',
      }),
      /valid HTTPS URL/,
    );
    await assert.rejects(
      fetchReplyEmails({
        ...options,
        sessionUrl: 'http://mail.example.test/session',
        mailboxId: 'inbox-1',
      }),
      /HTTPS URL/,
    );
    await assert.rejects(
      fetchReplyEmails({
        ...options,
        accessToken: '',
        mailboxId: 'inbox-1',
      }),
      /accessToken/,
    );
    await assert.rejects(
      fetchReplyEmails({ ...options, mailboxId: '' }),
      /mailboxId/,
    );
  });

  it('rejects API URLs outside the session origin and incomplete sessions', async () => {
    const offOrigin = client([
      jsonResponse({ ...SESSION, apiUrl: 'https://other.example.test/jmap' }),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...offOrigin.options, mailboxId: 'inbox-1' }),
      /session URL HTTPS origin/,
    );
    const missingCapability = client([
      jsonResponse({ apiUrl: SESSION.apiUrl, capabilities: {} }),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...missingCapability.options, mailboxId: 'inbox-1' }),
      /capabilities/,
    );
  });

  it('rejects method errors, invalid query IDs, and missing email records', async () => {
    const methodError = client([
      jsonResponse(SESSION),
      methodResponse('error', { type: 'serverFail' }, 'query'),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...methodError.options, mailboxId: 'inbox-1' }),
      /serverFail/,
    );
    const unexpectedMethod = client([
      jsonResponse(SESSION),
      methodResponse('Email/get', { ids: [] }, 'query'),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...unexpectedMethod.options, mailboxId: 'inbox-1' }),
      /instead of Email\/query/,
    );
    const missingMethodResult = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: [] }, 'different-call-id'),
    ]);
    await assert.rejects(
      fetchReplyEmails({
        ...missingMethodResult.options,
        mailboxId: 'inbox-1',
      }),
      /missing Email\/query/,
    );
    const missingErrorType = client([
      jsonResponse(SESSION),
      methodResponse('error', { type: 3 }, 'query'),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...missingErrorType.options, mailboxId: 'inbox-1' }),
      /Email\/query failed$/,
    );
    const invalidIds = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1', 3] }, 'query'),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...invalidIds.options, mailboxId: 'inbox-1' }),
      /invalid ids/,
    );
    const notFound = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse('Email/get', { list: [], notFound: ['email-1'] }, 'get'),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...notFound.options, mailboxId: 'inbox-1' }),
      /notFound/,
    );
  });

  it('rejects oversized and unsuccessful HTTP responses', async () => {
    const declaredTooLarge = client([
      new Response('{}', {
        headers: { 'content-length': String(2 * 1024 * 1024 + 1) },
      }),
    ]);
    await assert.rejects(
      fetchReplyEmails({
        ...declaredTooLarge.options,
        mailboxId: 'inbox-1',
      }),
      /size limit/,
    );
    const tooLarge = client([new Response('x'.repeat(2 * 1024 * 1024 + 1))]);
    await assert.rejects(
      fetchReplyEmails({ ...tooLarge.options, mailboxId: 'inbox-1' }),
      /size limit/,
    );
    const failedHttp = client([new Response('unavailable', { status: 503 })]);
    await assert.rejects(
      fetchReplyEmails({ ...failedHttp.options, mailboxId: 'inbox-1' }),
      /HTTP 503/,
    );
    const invalidJson = client([new Response('{invalid json')]);
    await assert.rejects(
      fetchReplyEmails({ ...invalidJson.options, mailboxId: 'inbox-1' }),
      /not valid JSON/,
    );
    const missingBody = client([new Response(null)]);
    await assert.rejects(
      fetchReplyEmails({ ...missingBody.options, mailboxId: 'inbox-1' }),
      /no body/,
    );
  });

  it('rejects malformed API URLs and API responses without method results', async () => {
    const invalidApiUrl = client([
      jsonResponse({ ...SESSION, apiUrl: 'https://[invalid' }),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...invalidApiUrl.options, mailboxId: 'inbox-1' }),
      /valid HTTPS URL/,
    );
    const missingMethodResponses = client([
      jsonResponse(SESSION),
      jsonResponse({}),
    ]);
    await assert.rejects(
      fetchReplyEmails({
        ...missingMethodResponses.options,
        mailboxId: 'inbox-1',
      }),
      /missing methodResponses/,
    );
  });

  it('marks the email processed with a keyword patch when acknowledged', async () => {
    const { options, requests } = client([
      jsonResponse(SESSION),
      methodResponse('Email/set', { updated: { 'email-1': null } }, 'set'),
    ]);
    await acknowledgeReplyEmail(options, 'email-1');
    const body = JSON.parse(String(requests[1]!.init?.body));
    assert.deepEqual(body.methodCalls[0][1].update, {
      'email-1': { 'keywords/trustrootsProcessed': true },
    });
  });

  it('rejects failed acknowledgements and an empty email ID', async () => {
    const notUpdated = client([
      jsonResponse(SESSION),
      methodResponse(
        'Email/set',
        {
          updated: { 'email-1': null },
          notUpdated: { 'email-1': { type: 'no' } },
        },
        'set',
      ),
    ]);
    await assert.rejects(
      acknowledgeReplyEmail(notUpdated.options, 'email-1'),
      /notUpdated/,
    );
    const notUpdatedId = client([
      jsonResponse(SESSION),
      methodResponse('Email/set', { updated: {} }, 'set'),
    ]);
    await assert.rejects(
      acknowledgeReplyEmail(notUpdatedId.options, 'email-1'),
      /did not update/,
    );
    const emptyId = client([]);
    await assert.rejects(
      acknowledgeReplyEmail(emptyId.options, ''),
      /id must be/,
    );
  });
});
