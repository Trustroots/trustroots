import { nip19 } from 'nostr-tools';
import { BunkerSigner } from 'nostr-tools/nip46';
import { signNostrProof } from '../../../client/services/nostr-proof.client';

const mockDestroy = jest.fn();
jest.mock('nostr-tools', () => ({
  ...jest.requireActual('nostr-tools'),
  SimplePool: jest.fn(() => ({ destroy: mockDestroy })),
}));
jest.mock('nostr-tools/nip46', () => ({
  BunkerSigner: { fromBunker: jest.fn() },
}));
const pubkey = '11'.repeat(32);
const npub = nip19.npubEncode(pubkey);
const event = { kind: 27235, created_at: 1, content: '', tags: [] };
const uri = `bunker://${'22'.repeat(32)}?relay=wss://relay.example.com&secret=fictional`;
const signer = {
  connect: jest.fn(),
  getPublicKey: jest.fn(),
  signEvent: jest.fn(),
  close: jest.fn(),
};

describe('Nostr proof signing transports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete window.nostr;
    signer.connect.mockResolvedValue(undefined);
    signer.getPublicKey.mockResolvedValue(pubkey);
    signer.signEvent.mockResolvedValue({
      ...event,
      pubkey,
      id: 'proof',
      sig: 'signature',
    });
    signer.close.mockResolvedValue(undefined);
    jest
      .mocked(BunkerSigner.fromBunker)
      .mockReturnValue(signer as unknown as BunkerSigner);
  });
  afterEach(() => jest.useRealTimers());
  const run = (
    method: 'browser' | 'bunker' = 'bunker',
    input = uri,
    signal = new AbortController().signal,
    onAuth = jest.fn(),
  ) => signNostrProof(event, npub, method, input, onAuth, signal);

  it('signs with a matching browser key', async () => {
    window.nostr = signer;
    await expect(run('browser')).resolves.toEqual(
      expect.objectContaining({ id: 'proof' }),
    );
    expect(signer.signEvent).toHaveBeenCalledWith(event);
  });
  it('rejects missing browser methods and mismatched keys', async () => {
    await expect(run('browser')).rejects.toThrow('Connect a browser');
    window.nostr = { getPublicKey: signer.getPublicKey };
    await expect(run('browser')).rejects.toThrow('Connect a browser');
    window.nostr = signer;
    signer.getPublicKey.mockResolvedValue('33'.repeat(32));
    await expect(run('browser')).rejects.toThrow('does not match');
    expect(signer.signEvent).not.toHaveBeenCalled();
  });
  it('rejects a non-public key', async () => {
    await expect(
      signNostrProof(
        event,
        nip19.nsecEncode(new Uint8Array(32)),
        'browser',
        '',
        jest.fn(),
        new AbortController().signal,
      ),
    ).rejects.toThrow('valid npub');
  });
  it('connects a bunker, uses its signing key and releases relay resources', async () => {
    await expect(run()).resolves.toEqual(
      expect.objectContaining({ id: 'proof' }),
    );
    expect(BunkerSigner.fromBunker).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.objectContaining({ pubkey: '22'.repeat(32), secret: 'fictional' }),
      expect.objectContaining({ skipSwitchRelays: true }),
    );
    expect(signer.close).toHaveBeenCalledTimes(1);
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });
  it('supports bunker URIs without a secret', async () => {
    await run('bunker', uri.replace('&secret=fictional', ''));
    expect(BunkerSigner.fromBunker).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ secret: null }),
      expect.anything(),
    );
  });
  it.each([
    'invalid',
    'https://example.com',
    `bunker://invalid?relay=wss://relay.example.com`,
    `bunker://${pubkey}`,
    `bunker://${pubkey}?${Array(9).fill('relay=wss://relay.example.com').join('&')}`,
    uri.replace('wss:', 'ws:'),
    uri.replace('relay.example.com', 'name:password@relay.example.com'),
    uri.replace('&secret', '%23fragment&secret'),
  ])('rejects malformed bunker input %s', async input => {
    await expect(run('bunker', input)).rejects.toThrow();
    expect(signer.signEvent).not.toHaveBeenCalled();
  });
  it.each(['connect', 'getPublicKey', 'signEvent'] as const)(
    'closes after %s fails',
    async method => {
      signer[method].mockRejectedValue(new Error('refused'));
      await expect(run()).rejects.toThrow('refused');
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    },
  );
  it('rejects a bunker with a mismatched user key', async () => {
    signer.getPublicKey.mockResolvedValue('33'.repeat(32));
    await expect(run()).rejects.toThrow('does not match');
    expect(signer.signEvent).not.toHaveBeenCalled();
  });
  it('shows HTTPS authorisation URLs and rejects invalid ones', async () => {
    const onAuth = jest.fn();
    signer.connect.mockImplementation(async () => {
      const calls = jest.mocked(BunkerSigner.fromBunker).mock.calls;
      calls[calls.length - 1][2]!.onauth!(
        'https://signer.example.com/authorise',
      );
    });
    await run('bunker', uri, new AbortController().signal, onAuth);
    expect(onAuth).toHaveBeenCalledWith('https://signer.example.com/authorise');
    signer.connect.mockImplementation(() => {
      const calls = jest.mocked(BunkerSigner.fromBunker).mock.calls;
      calls[calls.length - 1][2]!.onauth!('javascript:invalid');
      return new Promise(() => {});
    });
    await expect(run()).rejects.toThrow('invalid authorisation');
  });
  it('cancels before work begins', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(run('bunker', uri, controller.signal)).rejects.toThrow(
      'cancelled',
    );
    expect(BunkerSigner.fromBunker).not.toHaveBeenCalled();
  });
  it('times out pending requests, closes and avoids signing after timeout', async () => {
    jest.useFakeTimers();
    let finish!: () => void;
    signer.connect.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    );
    const result = run();
    const assertion = expect(result).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(120_000);
    await assertion;
    expect(mockDestroy).toHaveBeenCalledTimes(1);
    finish();
    await Promise.resolve();
    expect(signer.signEvent).not.toHaveBeenCalled();
  });
  it('destroys the relay pool even if signer closure fails', async () => {
    signer.close.mockRejectedValue(new Error('close failed'));
    await expect(run()).rejects.toThrow('close failed');
    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });
});
