import {
  buildNip55Uri,
  buildNostrConnectUri,
  connectBunkerSigner,
  connectNostrConnectSigner,
  getNip07Signer,
  isSignedNostrEvent,
  parseNip55Result,
  ValidatingNostrPool,
  validateNostrRelay,
  validateNostrRelays,
} from '@/modules/users/client/services/nostr-signers.client';

jest.mock('nostr-tools/nip46', () => ({
  BUNKER_REGEX: /^bunker:\/\/([0-9a-f]{64})\??([?\x2f\w:.=&%-]*)$/,
  BunkerSigner: {
    fromBunker: jest.fn(),
    fromURI: jest.fn(),
  },
  parseBunkerInput: jest.fn(async (input: string) => {
    const match = input.match(
      /^bunker:\/\/([0-9a-f]{64})\??([?\x2f\w:.=&%-]*)$/,
    );
    if (!match) return null;
    const query = new URLSearchParams(match[2]);
    return {
      pubkey: match[1],
      relays: query.getAll('relay'),
      secret: query.get('secret'),
    };
  }),
  createNostrConnectURI: jest.fn(
    () =>
      'nostrconnect://client?relay=wss%3A%2F%2Frelay.example&secret=temporary',
  ),
}));
jest.mock('nostr-tools', () => ({
  ...jest.requireActual('nostr-tools'),
  SimplePool: class {
    async ensureRelay(url: string) {
      return { url };
    }

    destroy() {}
  },
}));

const nip46Mock = jest.requireMock('nostr-tools/nip46') as {
  BunkerSigner: {
    fromBunker: jest.Mock;
    fromURI: jest.Mock;
  };
  createNostrConnectURI: jest.Mock;
};

const publicKey = 'a'.repeat(64);

function makeSigner(relays = ['wss://relay.example']) {
  const signer = {
    bp: { pubkey: publicKey, relays, secret: null as string | null },
    connect: jest.fn().mockResolvedValue(undefined),
    sendRequest: jest.fn().mockResolvedValue(JSON.stringify(relays)),
    switchRelays: jest.fn(async () => {
      const response = await signer.sendRequest('switch_relays', []);
      const nextRelays: unknown = JSON.parse(response);
      if (Array.isArray(nextRelays)) signer.bp.relays = nextRelays;
      return true;
    }),
    getPublicKey: jest.fn().mockResolvedValue(publicKey),
    signEvent: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return signer;
}

describe('Nostr signer adapters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete window.nostr;
  });

  it('accepts secure relay addresses and rejects insecure or local addresses', () => {
    expect(validateNostrRelay(' wss://relay.example ')).toBe(
      'wss://relay.example',
    );
    expect(() => validateNostrRelay('ws://relay.example')).toThrow(
      'Enter a secure wss:// relay address.',
    );
    expect(validateNostrRelay('wss://localhost')).toBe('wss://localhost');
    expect(validateNostrRelay('wss://127.0.0.1')).toBe('wss://127.0.0.1');
    expect(() => validateNostrRelay('wss://user:secret@relay.example')).toThrow(
      'Enter a secure wss:// relay address.',
    );
    expect(() => validateNostrRelay('wss://relay.example/#fragment')).toThrow(
      'Enter a secure wss:// relay address.',
    );
    expect(() => validateNostrRelay('invalid')).toThrow();
  });

  it('allows pool connections only to validated relays and replaces that allowlist', async () => {
    const pool = new ValidatingNostrPool(['wss://relay.example']);
    await expect(pool.ensureRelay('wss://relay.example')).resolves.toEqual({
      url: 'wss://relay.example',
    });
    await expect(pool.ensureRelay('wss://other.example')).rejects.toThrow(
      'The NIP-46 signer requested an unapproved relay.',
    );
    pool.allow(['wss://other.example']);
    await expect(pool.ensureRelay('wss://other.example')).resolves.toEqual({
      url: 'wss://other.example',
    });
    await expect(pool.ensureRelay('ws://unsafe.example')).rejects.toThrow(
      'Enter a secure wss:// relay address.',
    );
  });

  it('requires one to eight unique secure relays', () => {
    expect(() => validateNostrRelays([])).toThrow(
      'Choose between one and eight secure relay addresses.',
    );
    expect(() =>
      validateNostrRelays(Array(9).fill('wss://relay.example')),
    ).toThrow('Choose between one and eight secure relay addresses.');
    expect(
      validateNostrRelays(['wss://relay.example', 'wss://relay.example']),
    ).toEqual(['wss://relay.example']);
  });

  it('adapts browser extensions that support both key lookup and signing', async () => {
    expect(getNip07Signer()).toBeUndefined();
    window.nostr = { getPublicKey: jest.fn().mockResolvedValue(publicKey) };
    expect(getNip07Signer()).toBeUndefined();

    const signEvent = jest.fn().mockResolvedValue({ id: 'id' });
    window.nostr = {
      getPublicKey: jest.fn().mockResolvedValue(publicKey),
      signEvent,
    };
    const signer = getNip07Signer();
    expect(signer).toBeDefined();
    await expect(signer?.getPublicKey()).resolves.toBe(publicKey);
    await signer?.signEvent({
      kind: 27235,
      created_at: 1,
      tags: [],
      content: '',
    });
    expect(signEvent).toHaveBeenCalledTimes(1);
    await signer?.close();
  });

  it('creates temporary Nostr Connect credentials and a request URI', () => {
    const session = buildNostrConnectUri(['wss://relay.example']);
    expect(session.secretKey).toBeInstanceOf(Uint8Array);
    expect(nip46Mock.createNostrConnectURI).toHaveBeenCalledWith(
      expect.objectContaining({
        relays: ['wss://relay.example'],
        perms: ['get_public_key', 'sign_event:27235'],
      }),
    );
  });

  it('connects to bunker relays and validates a signers relay switch', async () => {
    const signer = makeSigner();
    signer.sendRequest.mockResolvedValue(
      JSON.stringify(['wss://new-relay.example']),
    );
    nip46Mock.BunkerSigner.fromBunker.mockReturnValue(signer);

    const connection = await connectBunkerSigner(
      `bunker://${publicKey}?relay=wss%3A%2F%2Frelay.example&secret=temporary`,
      [],
      jest.fn(),
      new AbortController().signal,
    );

    expect(signer.connect).toHaveBeenCalledTimes(1);
    expect(signer.bp.relays).toEqual(['wss://new-relay.example']);
    await expect(connection.getPublicKey()).resolves.toBe(publicKey);
    signer.signEvent.mockResolvedValue('signed');
    await expect(
      connection.signEvent({
        kind: 27235,
        created_at: 1,
        tags: [],
        content: '',
      }),
    ).resolves.toBe('signed');
    await connection.close();
    expect(signer.close).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported bunker URIs and relays before connecting', async () => {
    await expect(
      connectBunkerSigner(
        'bunker://[broken',
        [],
        jest.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow('Enter a valid bunker:// URI.');
    await expect(
      connectBunkerSigner(
        'https://relay.example',
        [],
        jest.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow('Enter a valid bunker:// URI.');
    await expect(
      connectBunkerSigner(
        'bunker://invalid?relay=wss%3A%2F%2Frelay.example',
        [],
        jest.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow('The bunker URI must contain a valid public key.');
    await expect(
      connectBunkerSigner(
        `bunker://${publicKey}`,
        [],
        jest.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow('Choose between one and eight secure relay addresses.');
    expect(nip46Mock.BunkerSigner.fromBunker).not.toHaveBeenCalled();
  });

  it('rejects a bunker URI the library cannot parse', async () => {
    jest
      .mocked(jest.requireMock('nostr-tools/nip46').parseBunkerInput)
      .mockResolvedValueOnce(null);
    await expect(
      connectBunkerSigner(
        `bunker://${publicKey}?relay=wss%3A%2F%2Frelay.example`,
        [],
        jest.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow('The bunker URI must contain a valid public key.');
  });

  it('does not allow insecure relays returned by a bunker', async () => {
    const signer = makeSigner();
    signer.sendRequest.mockResolvedValue(
      JSON.stringify(['ws://unsafe.example']),
    );
    nip46Mock.BunkerSigner.fromBunker.mockReturnValue(signer);

    await connectBunkerSigner(
      `bunker://${publicKey}?relay=wss%3A%2F%2Frelay.example`,
      [],
      jest.fn(),
      new AbortController().signal,
    );

    expect(signer.bp.relays).toEqual(['wss://relay.example']);
  });

  it('rejects malformed relay-switch responses and honours relay overrides', async () => {
    const signer = makeSigner();
    signer.sendRequest.mockResolvedValue('not json');
    nip46Mock.BunkerSigner.fromBunker.mockReturnValue(signer);
    await connectBunkerSigner(
      `bunker://${publicKey}?relay=wss%3A%2F%2Frelay.example`,
      ['wss://chosen.example'],
      jest.fn(),
      new AbortController().signal,
    );
    expect(signer.bp.relays).toEqual(['wss://relay.example']);
    expect(nip46Mock.BunkerSigner.fromBunker).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.objectContaining({ relays: ['wss://chosen.example'] }),
      expect.any(Object),
    );
  });

  it('uses the generated Nostr Connect session without repeating connect', async () => {
    const signer = makeSigner();
    nip46Mock.BunkerSigner.fromURI.mockResolvedValue(signer);
    const connection = await connectNostrConnectSigner(
      'nostrconnect://client?relay=wss%3A%2F%2Frelay.example&secret=temporary',
      new Uint8Array(32),
      jest.fn(),
      new AbortController().signal,
    );
    expect(signer.connect).not.toHaveBeenCalled();
    await expect(connection.getPublicKey()).resolves.toBe(publicKey);
  });

  it('rejects invalid generated connection URIs and aborts pending pairing', async () => {
    await expect(
      connectNostrConnectSigner(
        'https://relay.example',
        new Uint8Array(32),
        jest.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow('The generated Nostr Connect URI is invalid.');

    const controller = new AbortController();
    nip46Mock.BunkerSigner.fromURI.mockReturnValue(
      new Promise(() => undefined),
    );
    const pending = connectNostrConnectSigner(
      'nostrconnect://client?relay=wss%3A%2F%2Frelay.example&secret=temporary',
      new Uint8Array(32),
      jest.fn(),
      controller.signal,
    );
    controller.abort();
    await expect(pending).rejects.toThrow('NIP-46 connection was cancelled.');
  });

  it('rejects a bunker request that was already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      connectBunkerSigner(
        `bunker://${publicKey}?relay=wss%3A%2F%2Frelay.example`,
        [],
        jest.fn(),
        controller.signal,
      ),
    ).rejects.toThrow('NIP-46 connection was cancelled.');
    await expect(
      connectNostrConnectSigner(
        'nostrconnect://client?relay=wss%3A%2F%2Frelay.example&secret=temporary',
        new Uint8Array(32),
        jest.fn(),
        controller.signal,
      ),
    ).rejects.toThrow('NIP-46 connection was cancelled.');
  });

  it('cancels an in-flight bunker connection and closes its resources', async () => {
    const controller = new AbortController();
    const signer = makeSigner();
    signer.connect.mockReturnValue(new Promise(() => undefined));
    nip46Mock.BunkerSigner.fromBunker.mockReturnValue(signer);
    const pending = connectBunkerSigner(
      `bunker://${publicKey}?relay=wss%3A%2F%2Frelay.example`,
      [],
      jest.fn(),
      controller.signal,
    );
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.toThrow('NIP-46 connection was cancelled.');
    expect(signer.close).toHaveBeenCalledTimes(1);
  });

  it('forwards ordinary bunker requests and rejects invalid relay switch payloads', async () => {
    const signer = makeSigner();
    signer.signEvent.mockImplementation((event: unknown) =>
      signer.sendRequest('sign_event', [JSON.stringify(event)]),
    );
    nip46Mock.BunkerSigner.fromBunker.mockReturnValue(signer);
    const connection = await connectBunkerSigner(
      `bunker://${publicKey}?relay=wss%3A%2F%2Frelay.example`,
      [],
      jest.fn(),
      new AbortController().signal,
    );
    await connection.signEvent({
      kind: 27235,
      created_at: 1,
      tags: [],
      content: '',
    });
    await connection.close();
  });

  it('builds correlated same-origin NIP-55 requests with complete event returns', () => {
    const keyRequest = new URL(buildNip55Uri('get_public_key', 'operation-id'));
    expect(keyRequest.protocol).toBe('nostrsigner:');
    expect(keyRequest.searchParams.get('type')).toBe('get_public_key');
    expect(keyRequest.searchParams.get('callbackUrl')).toContain(
      'nostrOperation=operation-id',
    );
    expect(keyRequest.searchParams.get('callbackUrl')).toContain(
      'nostrResult=',
    );

    const event = {
      kind: 27235,
      created_at: 10,
      tags: [],
      content: 'challenge',
    };
    const signRequest = new URL(
      buildNip55Uri('sign_event', 'other-operation', event, publicKey),
    );
    expect(signRequest.searchParams.get('returnType')).toBe('event');
    expect(signRequest.searchParams.get('current_user')).toBe(publicKey);
    expect(decodeURIComponent(signRequest.pathname)).toContain('"kind":27235');
  });

  it('parses JSON and text clipboard results and checks signed event shape', () => {
    expect(parseNip55Result('{"pubkey":"abc"}')).toEqual({ pubkey: 'abc' });
    expect(parseNip55Result('a'.repeat(64))).toBe('a'.repeat(64));
    expect(() => parseNip55Result('  ')).toThrow(
      'The signer returned an empty result.',
    );
    expect(isSignedNostrEvent({})).toBe(false);
    expect(isSignedNostrEvent(null)).toBe(false);
    expect(
      isSignedNostrEvent({
        id: 'id',
        pubkey: 'pubkey',
        sig: 'signature',
        kind: 27235,
        created_at: 1,
        tags: [],
        content: '',
      }),
    ).toBe(true);
  });
});
