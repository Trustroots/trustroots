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

function streamedResponse(chunks: string[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      },
    }),
  );
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
    const sessionResponse = streamedResponse([
      JSON.stringify(SESSION).slice(0, 17),
      JSON.stringify(SESSION).slice(17),
    ]);
    const { options, requests } = client([
      sessionResponse,
      methodResponse('Email/query', { ids: ['email-1'], total: 1 }, 'query'),
      methodResponse(
        'Email/get',
        {
          list: [
            {
              id: 'email-1',
              from: [{ name: 'Example Sender', email: 'sender@example.test' }],
              to: [{ email: 'inbox@example.test' }],
              messageId: ['<reply@example.test>', '<earlier@example.test>'],
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
        messageId: '<reply@example.test> <earlier@example.test>',
        autoSubmitted: 'no',
        text: 'First part\nSecond part',
        truncated: true,
      },
    ]);
    assert.equal(requests.length, 3);
    assert.equal(requests[0]!.url, options.sessionUrl);
    assert.equal(requests[0]!.init?.method, 'GET');
    assert.equal(requests[0]!.init?.redirect, 'error');
    assert.deepEqual(requests[0]!.init?.headers, {
      Authorization: 'Bearer fictional-token',
    });
    assert.ok(requests[0]!.init?.signal instanceof AbortSignal);
    assert.equal(sessionResponse.body?.locked, false);
    assert.equal(requests[1]!.url, SESSION.apiUrl);
    assert.equal(requests[1]!.init?.method, 'POST');
    assert.equal(requests[1]!.init?.redirect, 'error');
    assert.deepEqual(requests[1]!.init?.headers, {
      Authorization: 'Bearer fictional-token',
      'Content-Type': 'application/json',
    });
    assert.ok(requests[1]!.init?.signal instanceof AbortSignal);
    const queryBody = JSON.parse(String(requests[1]!.init?.body));
    assert.deepEqual(queryBody, {
      using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
      methodCalls: [
        [
          'Email/query',
          {
            accountId: 'fictional-account',
            filter: { inMailbox: 'inbox-1', notKeyword: 'trustrootsProcessed' },
            limit: 20,
            sort: [{ property: 'receivedAt', isAscending: true }],
          },
          'query',
        ],
      ],
    });
    assert.equal(requests[2]!.url, SESSION.apiUrl);
    assert.equal(requests[2]!.init?.method, 'POST');
    assert.equal(requests[2]!.init?.redirect, 'error');
    assert.deepEqual(requests[2]!.init?.headers, {
      Authorization: 'Bearer fictional-token',
      'Content-Type': 'application/json',
    });
    assert.ok(requests[2]!.init?.signal instanceof AbortSignal);
    const getBody = JSON.parse(String(requests[2]!.init?.body));
    assert.deepEqual(getBody, {
      using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
      methodCalls: [
        [
          'Email/get',
          {
            accountId: 'fictional-account',
            ids: ['email-1'],
            properties: [
              'id',
              'from',
              'to',
              'messageId',
              'textBody',
              'bodyValues',
              'header:Auto-Submitted:asText',
            ],
            fetchTextBodyValues: true,
            maxBodyValueBytes: 20_000,
          },
          'get',
        ],
      ],
    });
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

  it('caps Email/get IDs at 20 even when the query returns too many', async () => {
    const ids = Array.from({ length: 21 }, (_value, index) => `email-${index}`);
    const { options, requests } = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids }, 'query'),
      methodResponse(
        'Email/get',
        { list: ids.slice(0, 20).map(id => ({ id })) },
        'get',
      ),
    ]);
    const emails = await fetchReplyEmails({ ...options, mailboxId: 'inbox-1' });
    assert.equal(emails.length, 20);
    const getBody = JSON.parse(String(requests[2]!.init?.body));
    assert.deepEqual(getBody.methodCalls[0][1].ids, ids.slice(0, 20));
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
              bodyValues: {
                'plain-1': { value: 'Partial' },
                'plain-2': { value: 'Bad encoding', isEncodingProblem: true },
                'plain-3': { value: 'Missing value' },
                'plain-4': {},
              },
              textBody: [
                { partId: 'plain-1' },
                { partId: 'plain-2' },
                { partId: 'plain-3' },
                { partId: 'plain-4' },
              ],
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
    assert.equal(email?.text, 'Partial\nBad encoding\nMissing value');

    const truncatedBody = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse(
        'Email/get',
        {
          list: [
            {
              id: 'email-1',
              textBody: [{ partId: 'plain-1' }],
              bodyValues: {
                'plain-1': {
                  value: 'Server truncated',
                  isTruncated: true,
                  isEncodingProblem: false,
                },
              },
            },
          ],
        },
        'get',
      ),
    ]);
    const [truncatedEmail] = await fetchReplyEmails({
      ...truncatedBody.options,
      mailboxId: 'inbox-1',
    });
    assert.equal(truncatedEmail?.truncated, true);

    const missingPartId = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse(
        'Email/get',
        {
          list: [
            {
              id: 'email-1',
              textBody: [{}],
              bodyValues: { undefined: { value: 'must not be used' } },
            },
          ],
        },
        'get',
      ),
    ]);
    const [emailWithoutPartId] = await fetchReplyEmails({
      ...missingPartId.options,
      mailboxId: 'inbox-1',
    });
    assert.equal(emailWithoutPartId?.text, '');
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
    const emptySender = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse(
        'Email/get',
        { list: [{ id: 'email-1', from: [{ email: '' }] }] },
        'get',
      ),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...emptySender.options, mailboxId: 'inbox-1' }),
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

    const missingRecord = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse('Email/get', { list: [] }, 'get'),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...missingRecord.options, mailboxId: 'inbox-1' }),
      /ids do not match/,
    );

    const duplicateRecords = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1', 'email-2'] }, 'query'),
      methodResponse(
        'Email/get',
        { list: [{ id: 'email-1' }, { id: 'email-1' }] },
        'get',
      ),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...duplicateRecords.options, mailboxId: 'inbox-1' }),
      /ids do not match/,
    );

    const extraDuplicate = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse(
        'Email/get',
        { list: [{ id: 'email-1' }, { id: 'email-1' }] },
        'get',
      ),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...extraDuplicate.options, mailboxId: 'inbox-1' }),
      /ids do not match/,
    );

    const mixedExtra = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1', 'email-2'] }, 'query'),
      methodResponse(
        'Email/get',
        { list: [{ id: 'email-1' }, { id: 'other-email' }] },
        'get',
      ),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...mixedExtra.options, mailboxId: 'inbox-1' }),
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
    const listWithInvalidRecord = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse('Email/get', { list: [null] }, 'get'),
    ]);
    await assert.rejects(
      fetchReplyEmails({
        ...listWithInvalidRecord.options,
        mailboxId: 'inbox-1',
      }),
      /invalid list/,
    );
    const listWithNonObjectRecord = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse('Email/get', { list: [5] }, 'get'),
    ]);
    await assert.rejects(
      fetchReplyEmails({
        ...listWithNonObjectRecord.options,
        mailboxId: 'inbox-1',
      }),
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

  it('returns complete untruncated text body values', async () => {
    const { options } = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse(
        'Email/get',
        {
          list: [
            {
              id: 'email-1',
              from: [{ email: 'sender@example.test' }],
              to: [{ email: 'inbox@example.test' }],
              messageId: [],
              textBody: [{ partId: 'plain-1' }],
              bodyValues: { 'plain-1': { value: 'Complete body' } },
              'header:Auto-Submitted:asText': '',
            },
          ],
        },
        'get',
      ),
    ]);
    assert.deepEqual(
      await fetchReplyEmails({ ...options, mailboxId: 'inbox-1' }),
      [
        {
          id: 'email-1',
          from: ['sender@example.test'],
          to: ['inbox@example.test'],
          messageId: null,
          autoSubmitted: '',
          text: 'Complete body',
          truncated: false,
        },
      ],
    );
  });

  it('marks an empty text body truncated', async () => {
    const { options } = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse(
        'Email/get',
        { list: [{ id: 'email-1', textBody: [], bodyValues: {} }] },
        'get',
      ),
    ]);
    const [email] = await fetchReplyEmails({
      ...options,
      mailboxId: 'inbox-1',
    });
    assert.deepEqual(email, {
      id: 'email-1',
      from: [],
      to: [],
      messageId: null,
      autoSubmitted: null,
      text: '',
      truncated: true,
    });
  });

  it('marks a body value with an encoding problem as truncated on its own', async () => {
    const { options } = client([
      jsonResponse(SESSION),
      methodResponse('Email/query', { ids: ['email-1'] }, 'query'),
      methodResponse(
        'Email/get',
        {
          list: [
            {
              id: 'email-1',
              textBody: [{ partId: 'plain-1' }],
              bodyValues: {
                'plain-1': {
                  value: 'Unreadable source text',
                  isTruncated: false,
                  isEncodingProblem: true,
                },
              },
            },
          ],
        },
        'get',
      ),
    ]);
    const [email] = await fetchReplyEmails({
      ...options,
      mailboxId: 'inbox-1',
    });
    assert.equal(email?.truncated, true);
    assert.equal(email?.text, 'Unreadable source text');
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
        sessionUrl: 'https://user:secret@mail.example.test/session',
        mailboxId: 'inbox-1',
      }),
      /without credentials/,
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
    await assert.rejects(
      fetchReplyEmails({
        ...options,
        sessionUrl: undefined as unknown as string,
        mailboxId: 'inbox-1',
      }),
      { name: 'TypeError', message: 'sessionUrl must be a non-empty string' },
    );
    await assert.rejects(
      fetchReplyEmails({
        ...options,
        accessToken: 7 as unknown as string,
        mailboxId: 'inbox-1',
      }),
      { name: 'TypeError', message: 'accessToken must be a non-empty string' },
    );
    await assert.rejects(
      fetchReplyEmails({
        ...options,
        accountId: '' as string,
        mailboxId: 'inbox-1',
      }),
      { name: 'TypeError', message: 'accountId must be a non-empty string' },
    );
    await assert.rejects(
      fetchReplyEmails({
        ...options,
        sessionUrl: 'https://mail.example.test/session',
        accessToken: 'fictional-token',
        accountId: 'fictional-account',
        mailboxId: 'inbox-1',
        fetchImpl: async () => jsonResponse({ ...SESSION, apiUrl: '' }),
      }),
      { message: 'JMAP apiUrl must be a non-empty string' },
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
    const missingCoreCapability = client([
      jsonResponse({
        apiUrl: SESSION.apiUrl,
        capabilities: { 'urn:ietf:params:jmap:mail': {} },
      }),
    ]);
    await assert.rejects(
      fetchReplyEmails({
        ...missingCoreCapability.options,
        mailboxId: 'inbox-1',
      }),
      { message: 'JMAP session does not advertise core and mail capabilities' },
    );
    const missingMailCapability = client([
      jsonResponse({
        apiUrl: SESSION.apiUrl,
        capabilities: { 'urn:ietf:params:jmap:core': {} },
      }),
    ]);
    await assert.rejects(
      fetchReplyEmails({
        ...missingMailCapability.options,
        mailboxId: 'inbox-1',
      }),
      { message: 'JMAP session does not advertise core and mail capabilities' },
    );
    const insecureApiUrl = client([
      jsonResponse({ ...SESSION, apiUrl: 'http://mail.example.test/jmap' }),
    ]);
    await assert.rejects(
      fetchReplyEmails({ ...insecureApiUrl.options, mailboxId: 'inbox-1' }),
      { message: 'JMAP apiUrl must use the session URL HTTPS origin' },
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
    const boundaryJson = JSON.stringify(SESSION);
    const boundaryResponse = new Response(
      ' '.repeat(2 * 1024 * 1024 - boundaryJson.length) + boundaryJson,
      { headers: { 'content-length': String(2 * 1024 * 1024) } },
    );
    const boundary = client([
      boundaryResponse,
      methodResponse('Email/query', { ids: [] }, 'query'),
    ]);
    assert.deepEqual(
      await fetchReplyEmails({ ...boundary.options, mailboxId: 'inbox-1' }),
      [],
    );
    const tooLarge = client([new Response('x'.repeat(2 * 1024 * 1024 + 1))]);
    await assert.rejects(
      fetchReplyEmails({ ...tooLarge.options, mailboxId: 'inbox-1' }),
      /size limit/,
    );
    let cancelled = false;
    const oversizedStream = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1));
        },
        cancel() {
          cancelled = true;
        },
      }),
    );
    const streamedTooLarge = client([oversizedStream]);
    await assert.rejects(
      fetchReplyEmails({ ...streamedTooLarge.options, mailboxId: 'inbox-1' }),
      /size limit/,
    );
    assert.equal(cancelled, true);
    assert.equal(oversizedStream.body?.locked, false);
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
      methodResponse(
        'Email/set',
        { updated: { 'email-1': null }, notUpdated: {} },
        'set',
      ),
    ]);
    await acknowledgeReplyEmail(options, 'email-1');
    assert.equal(requests[1]!.url, SESSION.apiUrl);
    assert.equal(requests[1]!.init?.method, 'POST');
    assert.equal(requests[1]!.init?.redirect, 'error');
    assert.deepEqual(requests[1]!.init?.headers, {
      Authorization: 'Bearer fictional-token',
      'Content-Type': 'application/json',
    });
    assert.ok(requests[1]!.init?.signal instanceof AbortSignal);
    const body = JSON.parse(String(requests[1]!.init?.body));
    assert.deepEqual(body, {
      using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
      methodCalls: [
        [
          'Email/set',
          {
            accountId: 'fictional-account',
            update: {
              'email-1': { 'keywords/trustrootsProcessed': true },
            },
          },
          'set',
        ],
      ],
    });
  });

  it('accepts JMAP null for an empty notUpdated result', async () => {
    const { options } = client([
      jsonResponse(SESSION),
      methodResponse(
        'Email/set',
        { updated: { 'email-1': null }, notUpdated: null },
        'set',
      ),
    ]);
    await acknowledgeReplyEmail(options, 'email-1');
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
    const malformedNotUpdated = client([
      jsonResponse(SESSION),
      methodResponse(
        'Email/set',
        { updated: { 'email-1': null }, notUpdated: 'invalid' },
        'set',
      ),
    ]);
    await assert.rejects(
      acknowledgeReplyEmail(malformedNotUpdated.options, 'email-1'),
      { message: 'JMAP Email/set response has invalid notUpdated' },
    );
    const invalidUpdated = client([
      jsonResponse(SESSION),
      methodResponse('Email/set', { updated: 'email-1' }, 'set'),
    ]);
    await assert.rejects(
      acknowledgeReplyEmail(invalidUpdated.options, 'email-1'),
      /did not update/,
    );
    const emptyId = client([]);
    await assert.rejects(
      acknowledgeReplyEmail(emptyId.options, ''),
      /id must be/,
    );
  });
});
