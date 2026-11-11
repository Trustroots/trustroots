const JMAP_CORE_CAPABILITY = 'urn:ietf:params:jmap:core';
const JMAP_MAIL_CAPABILITY = 'urn:ietf:params:jmap:mail';
const PROCESSED_KEYWORD = 'trustrootsProcessed';
const MAX_EMAILS = 20;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_BODY_VALUE_BYTES = 20_000;
const REQUEST_TIMEOUT_MS = 15_000;

type EmailAddress = { email?: string | null; name?: string | null };
type JmapEmail = {
  id: string;
  from?: EmailAddress[] | null;
  to?: EmailAddress[] | null;
  messageId?: string[] | null;
  textBody?: Array<{ partId?: string | null }> | null;
  bodyValues?: Record<
    string,
    {
      value?: string;
      isTruncated?: boolean;
      isEncodingProblem?: boolean;
    }
  > | null;
  'header:Auto-Submitted:asText'?: string | null;
};

export type ReplyEmail = {
  id: string;
  from: string[];
  to: string[];
  messageId: string | null;
  autoSubmitted: string | null;
  text: string;
  truncated: boolean;
};

export type JmapOptions = {
  sessionUrl: string;
  accessToken: string;
  accountId: string;
  fetchImpl?: typeof fetch;
};

export type FetchReplyEmailsOptions = JmapOptions & { mailboxId: string };

type JmapMethodResponse = [string, Record<string, unknown>, string];
type JmapResponse = { methodResponses?: JmapMethodResponse[] };

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function sessionEndpoint(sessionUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(sessionUrl);
  } catch {
    throw new TypeError('sessionUrl must be a valid HTTPS URL');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new TypeError('sessionUrl must be an HTTPS URL without credentials');
  }
  return parsed;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`JMAP request failed with HTTP ${response.status}`);
  }
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new Error('JMAP response exceeds the size limit');
  }
  if (!response.body) throw new Error('JMAP response has no body');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('JMAP response exceeds the size limit');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new Error('JMAP response is not valid JSON');
  }
}

async function createClient(options: JmapOptions) {
  const sessionUrl = requiredString(options.sessionUrl, 'sessionUrl');
  const accessToken = requiredString(options.accessToken, 'accessToken');
  const accountId = requiredString(options.accountId, 'accountId');
  const sessionUrlParsed = sessionEndpoint(sessionUrl);
  const fetchImpl = options.fetchImpl ?? fetch;
  const sessionResponse = await fetchImpl(sessionUrlParsed, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    redirect: 'error',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const session = (await readJsonResponse(sessionResponse)) as {
    apiUrl?: unknown;
    capabilities?: Record<string, unknown>;
  };
  if (
    !session.capabilities ||
    !(JMAP_CORE_CAPABILITY in session.capabilities) ||
    !(JMAP_MAIL_CAPABILITY in session.capabilities)
  ) {
    throw new Error(
      'JMAP session does not advertise core and mail capabilities',
    );
  }
  const apiUrl = requiredString(session.apiUrl, 'JMAP apiUrl');
  let apiUrlParsed: URL;
  try {
    apiUrlParsed = new URL(apiUrl, sessionUrlParsed);
  } catch {
    throw new Error('JMAP apiUrl must be a valid HTTPS URL');
  }
  if (
    apiUrlParsed.protocol !== 'https:' ||
    apiUrlParsed.origin !== sessionUrlParsed.origin ||
    apiUrlParsed.username ||
    apiUrlParsed.password
  ) {
    throw new Error('JMAP apiUrl must use the session URL HTTPS origin');
  }

  return {
    accountId,
    apiUrl: apiUrlParsed,
    async call(
      methodCalls: Array<[string, Record<string, unknown>, string]>,
    ): Promise<JmapResponse> {
      const response = await fetchImpl(apiUrlParsed, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          using: [JMAP_CORE_CAPABILITY, JMAP_MAIL_CAPABILITY],
          methodCalls,
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const payload = (await readJsonResponse(response)) as JmapResponse;
      if (!Array.isArray(payload.methodResponses)) {
        throw new Error('JMAP response is missing methodResponses');
      }
      return payload;
    },
  };
}

function methodResult(
  response: JmapResponse,
  method: string,
  callId: string,
): Record<string, unknown> {
  const result = response.methodResponses!.find(
    methodResponse => methodResponse[2] === callId,
  );
  if (!result) throw new Error(`JMAP response is missing ${method}`);
  if (result[0] === 'error') {
    const errorType = result[1].type;
    throw new Error(
      `JMAP ${method} failed${typeof errorType === 'string' ? `: ${errorType}` : ''}`,
    );
  }
  if (result[0] !== method) {
    throw new Error(`JMAP response returned ${result[0]} instead of ${method}`);
  }
  return result[1];
}

function addressList(value: EmailAddress[] | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(address => {
    if (typeof address.email !== 'string' || address.email.length === 0) {
      throw new Error(
        'JMAP Email/get response contains an invalid email address',
      );
    }
    return address.email;
  });
}

function emailText(email: JmapEmail): { text: string; truncated: boolean } {
  const bodyValues = email.bodyValues ?? {};
  const textParts = email.textBody ?? [];
  let truncated = textParts.length === 0;
  const text = textParts.flatMap(part => {
    if (typeof part.partId !== 'string') {
      truncated = true;
      return [];
    }
    const bodyValue = bodyValues[part.partId];
    if (!bodyValue || typeof bodyValue.value !== 'string') {
      truncated = true;
      return [];
    }
    truncated ||=
      bodyValue.isTruncated === true || bodyValue.isEncodingProblem === true;
    return [bodyValue.value];
  });
  return { text: text.join('\n'), truncated };
}

/** Fetches up to 20 unprocessed plain-text replies from a configured mailbox. */
export async function fetchReplyEmails(
  options: FetchReplyEmailsOptions,
): Promise<ReplyEmail[]> {
  const mailboxId = requiredString(options.mailboxId, 'mailboxId');
  const client = await createClient(options);
  const queryResponse = await client.call([
    [
      'Email/query',
      {
        accountId: client.accountId,
        filter: { inMailbox: mailboxId, notKeyword: PROCESSED_KEYWORD },
        limit: MAX_EMAILS,
        sort: [{ property: 'receivedAt', isAscending: true }],
      },
      'query',
    ],
  ]);
  const query = methodResult(queryResponse, 'Email/query', 'query');
  if (
    !Array.isArray(query.ids) ||
    query.ids.some(id => typeof id !== 'string')
  ) {
    throw new Error('JMAP Email/query response has invalid ids');
  }
  const ids = query.ids.slice(0, MAX_EMAILS) as string[];
  if (ids.length === 0) return [];

  const getResponse = await client.call([
    [
      'Email/get',
      {
        accountId: client.accountId,
        ids,
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
        maxBodyValueBytes: MAX_BODY_VALUE_BYTES,
      },
      'get',
    ],
  ]);
  const get = methodResult(getResponse, 'Email/get', 'get');
  if (
    !Array.isArray(get.list) ||
    get.list.some(email => !email || typeof email !== 'object')
  ) {
    throw new Error('JMAP Email/get response has invalid list');
  }
  if (Array.isArray(get.notFound) && get.notFound.length > 0) {
    throw new Error('JMAP Email/get response contains notFound items');
  }

  const returnedIds = (get.list as JmapEmail[]).map(email => email.id);
  if (
    returnedIds.length !== ids.length ||
    new Set(returnedIds).size !== ids.length ||
    returnedIds.some(id => !ids.includes(id))
  ) {
    throw new Error('JMAP Email/get response ids do not match the query');
  }

  return (get.list as JmapEmail[]).map(email => {
    const body = emailText(email);
    return {
      id: email.id,
      from: addressList(email.from),
      to: addressList(email.to),
      messageId:
        Array.isArray(email.messageId) && email.messageId.length > 0
          ? email.messageId.join(' ')
          : null,
      autoSubmitted:
        typeof email['header:Auto-Submitted:asText'] === 'string'
          ? email['header:Auto-Submitted:asText']
          : null,
      text: body.text,
      truncated: body.truncated,
    };
  });
}

/** Marks a reply processed after its caller has successfully handled it. */
export async function acknowledgeReplyEmail(
  options: JmapOptions,
  id: string,
): Promise<void> {
  const emailId = requiredString(id, 'id');
  const client = await createClient(options);
  const response = await client.call([
    [
      'Email/set',
      {
        accountId: client.accountId,
        update: {
          [emailId]: { 'keywords/trustrootsProcessed': true },
        },
      },
      'set',
    ],
  ]);
  const set = methodResult(response, 'Email/set', 'set');
  if (
    set.notUpdated &&
    typeof set.notUpdated === 'object' &&
    emailId in set.notUpdated
  ) {
    throw new Error(
      'JMAP Email/set response contains notUpdated for the email',
    );
  }
  if (
    !set.updated ||
    typeof set.updated !== 'object' ||
    !(emailId in set.updated)
  ) {
    throw new Error('JMAP Email/set response did not update the email');
  }
}
