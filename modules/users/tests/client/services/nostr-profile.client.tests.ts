import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
  type Event,
  type EventTemplate,
} from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';
import http from '@trustroots/core/http-client';
import { withAuthenticatedNostrRelay } from '../../../../core/shared/nostr-authenticated-relay.mts';
import { publishNostrProfile } from '../../../client/services/nostr-profile.client';

vi.mock('nostr-tools/relay', () => ({ Relay: vi.fn() }));
vi.mock('@trustroots/core/http-client', () => ({
  default: { get: vi.fn() },
}));
vi.mock('../../../../core/shared/nostr-authenticated-relay.mts', () => ({
  withAuthenticatedNostrRelay: vi.fn(),
}));

const secret = generateSecretKey();
const pubkey = getPublicKey(secret);
const user = {
  username: 'example.member',
  nostrNpub: nip19.npubEncode(pubkey),
};
const nip05 = 'example.member@trustroots.org';
const auth: EventTemplate = {
  kind: 22242,
  content: '',
  tags: [['challenge', 'fixture']],
  created_at: 1,
};
const signal = new AbortController().signal;

function fixtureRelay(event?: Event) {
  const relay = {
    close: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue('accepted'),
    subscribe: vi.fn<Relay['subscribe']>(),
  };
  relay.subscribe.mockImplementation((_filters, handlers) => {
    if (event) handlers.onevent?.(event);
    handlers.oneose?.();
    return { close: vi.fn() } as unknown as ReturnType<Relay['subscribe']>;
  });
  return relay;
}

function metadata(content: string, created_at: number, tags: string[][] = []) {
  return finalizeEvent({ kind: 0, content, created_at, tags }, secret);
}

function setRelays(stored?: Event, publicEvent?: Event) {
  const primary = fixtureRelay(stored);
  const publicRelay = fixtureRelay(publicEvent);
  vi.mocked(Relay).mockImplementation(function () {
    return publicRelay as unknown as Relay;
  });
  vi.mocked(withAuthenticatedNostrRelay).mockImplementation(
    async (sign, run) => {
      await sign(auth);
      return run(primary as unknown as Relay);
    },
  );
  return { primary, publicRelay };
}

const sign = (event: EventTemplate) =>
  Promise.resolve(finalizeEvent(event, secret));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(http.get).mockResolvedValue({
    data: { names: { [user.username]: pubkey } },
  });
});

it('checks the public lookup before contacting a relay', async () => {
  vi.mocked(http.get).mockResolvedValue({ data: { names: {} } });
  await expect(publishNostrProfile(user, sign, signal)).resolves.toBe(
    'unavailable',
  );
  expect(http.get).toHaveBeenCalledWith(
    '/.well-known/nostr.json',
    expect.objectContaining({ params: { name: user.username } }),
  );
  expect(withAuthenticatedNostrRelay).not.toHaveBeenCalled();
});

it('rejects a key encoding other than npub before the public lookup', async () => {
  await expect(
    publishNostrProfile(
      {
        ...user,
        nostrNpub: nip19.noteEncode('f'.repeat(64)),
      },
      sign,
      signal,
    ),
  ).rejects.toThrow('Expected a Nostr public key');
  expect(http.get).not.toHaveBeenCalled();
});

it('publishes a minimal profile when neither relay has existing metadata', async () => {
  const { primary, publicRelay } = setRelays();
  await expect(publishNostrProfile(user, sign, signal)).resolves.toBe(
    'published',
  );
  expect(primary.publish).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 0,
      pubkey,
      content: JSON.stringify({ nip05 }),
      tags: [],
    }),
  );
  expect(publicRelay.publish).not.toHaveBeenCalled();
  expect(publicRelay.close).toHaveBeenCalledOnce();
});

it('merges the latest metadata and keeps its tags', async () => {
  const previous = {
    name: 'Example',
    nip05: 'previous@example.org',
    custom: 42,
  };
  const tags = [['alt', 'Profile']];
  const { primary } = setRelays(
    metadata('{}', 1),
    metadata(JSON.stringify(previous), 2, tags),
  );
  await publishNostrProfile(user, sign, signal);
  expect(primary.publish).toHaveBeenCalledWith(
    expect.objectContaining({
      content: JSON.stringify({ ...previous, nip05 }),
      tags,
    }),
  );
});

it('does not duplicate current metadata on the authenticated relay', async () => {
  const { primary } = setRelays(metadata(JSON.stringify({ nip05 }), 1));
  await expect(publishNostrProfile(user, sign, signal)).resolves.toBe(
    'published',
  );
  expect(primary.publish).not.toHaveBeenCalled();
});

it.each([
  ['non-object metadata', '[]', 1],
  ['future metadata', '{}', Math.floor(Date.now() / 1000) + 3600],
])(
  'preserves %s without writing a replacement',
  async (_description, content, timestamp) => {
    const { primary } = setRelays(metadata(content, timestamp));
    await expect(publishNostrProfile(user, sign, signal)).rejects.toThrow();
    expect(primary.publish).not.toHaveBeenCalled();
  },
);

it('rejects a signed event which changes the requested metadata', async () => {
  const { primary } = setRelays();
  const alter: typeof sign = event =>
    sign(event.kind === 0 ? { ...event, content: '{}' } : event);
  await expect(publishNostrProfile(user, alter, signal)).rejects.toThrow(
    'unexpected',
  );
  expect(primary.publish).not.toHaveBeenCalled();
});

it('does not publish when a metadata lookup times out', async () => {
  vi.useFakeTimers();
  try {
    const { primary, publicRelay } = setRelays();
    publicRelay.subscribe.mockReturnValue({
      close: vi.fn(),
    } as unknown as ReturnType<Relay['subscribe']>);
    const publication = publishNostrProfile(user, sign, signal);
    const rejection = expect(publication).rejects.toThrow('lookup timed out');
    await vi.advanceTimersByTimeAsync(5_000);
    await rejection;
    expect(primary.publish).not.toHaveBeenCalled();
    expect(publicRelay.close).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});

it('does not publish when a relay refuses to return stored metadata', async () => {
  const { primary } = setRelays();
  primary.subscribe.mockImplementation((_filters, handlers) => {
    handlers.onclose?.('restricted: fixture');
    return { close: vi.fn() } as unknown as ReturnType<Relay['subscribe']>;
  });
  await expect(publishNostrProfile(user, sign, signal)).rejects.toThrow(
    'restricted',
  );
  expect(primary.publish).not.toHaveBeenCalled();
});
