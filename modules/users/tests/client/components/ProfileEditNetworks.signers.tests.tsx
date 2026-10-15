import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import { nip19 } from 'nostr-tools';

import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import ProfileEditNetworks from '@/modules/users/client/components/ProfileEditNetworks.component';
import * as usersApi from '@/modules/users/client/api/users.api';
import * as signers from '@/modules/users/client/services/nostr-signers.client';
import type { UserProfile } from '@/modules/users/client/types';

jest.mock('@/modules/users/client/api/users.api');
jest.mock('@/modules/users/client/services/nostr-signers.client', () => ({
  DEFAULT_NOSTR_RELAY: 'wss://relay.example.com',
  NOSTR_SIGNER_TIMEOUT_MS: 120_000,
  buildNip55Uri: jest.fn(
    (method: string, id: string) => `nostrsigner:?type=${method}&id=${id}`,
  ),
  buildNostrConnectUri: jest.fn(),
  connectBunkerSigner: jest.fn(),
  connectNostrConnectSigner: jest.fn(),
  getNip07Signer: jest.fn(),
  isSignedNostrEvent: jest.fn((event: unknown) =>
    Boolean(event && typeof event === 'object' && 'sig' in event),
  ),
  parseNip55Result: jest.fn((value: string) => {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }),
  validateNostrRelays: jest.fn((relays: string[]) => relays),
}));
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,fixture'),
}));
jest.mock('nostr-tools', () => ({
  nip19: {
    npubEncode: jest.fn((hex: string) => `npub1${hex}`),
    decode: jest.fn((npub: string) => ({ type: 'npub', data: npub.slice(5) })),
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock(
  '@/modules/users/client/components/ProfileEditPage.component',
  () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => (
      <section>{children}</section>
    ),
  }),
);

const api = jest.mocked(usersApi);
const adapters = jest.mocked(signers);
const publicKey = 'a'.repeat(64);
const npub = `npub1${publicKey}`;
const user: UserProfile = {
  _id: 'member-1',
  username: 'fictional-member',
  displayName: 'Fictional Member',
  nostrNpub: npub,
};
const event: signers.SignedNostrEvent = {
  kind: 27235,
  content: '',
  created_at: 1,
  tags: [['challenge', 'fictional-nonce']],
  id: 'b'.repeat(64),
  sig: 'c'.repeat(128),
  pubkey: publicKey,
};
const pendingKey = 'trustroots.nostr.pending';

function renderPage(overrides: Partial<UserProfile> = {}) {
  const profile = { ...user, ...overrides };
  return render(
    <AppProviders
      bootstrapData={{
        env: 'test',
        isNativeMobileApp: false,
        settings: {},
        title: 'Trustroots',
        user: profile,
      }}
    >
      <ProfileEditNetworks user={profile} />
    </AppProviders>,
  );
}

function signer(
  overrides: Partial<signers.NostrSigner> = {},
): signers.NostrSigner {
  return {
    getPublicKey: jest.fn().mockResolvedValue(publicKey),
    signEvent: jest.fn().mockResolvedValue(event),
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function callback(
  result: unknown,
  options: Record<string, unknown> = {},
  operation = 'operation-1',
) {
  sessionStorage.setItem(
    pendingKey,
    JSON.stringify({
      operationId: 'operation-1',
      userId: user._id,
      expiresAt: Date.now() + 60_000,
      purpose: 'import',
      hasChanges: true,
      draft: { ...user, extSitesBW: 'unsaved-member' },
      ...options,
    }),
  );
  const url = new URL('/profile/edit/networks', window.location.origin);
  url.searchParams.set('nostrOperation', operation);
  url.searchParams.set(
    'nostrResult',
    typeof result === 'string' ? result : JSON.stringify(result),
  );
  window.history.replaceState({}, '', url.toString());
}

beforeEach(() => {
  jest.clearAllMocks();
  delete window.nostr;
  sessionStorage.clear();
  window.history.replaceState({}, '', '/profile/edit/networks');
  adapters.getNip07Signer.mockReturnValue(undefined);
  adapters.buildNostrConnectUri.mockReturnValue({
    uri: 'nostrconnect://fixture?relay=wss://relay.example.com&secret=fictional-secret',
    secretKey: new Uint8Array(32).fill(1),
  });
  api.createNostrVerificationChallenge.mockResolvedValue({
    event,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  api.verifyNostrKey.mockResolvedValue({
    ...user,
    nostrVerifiedAt: '2026-10-11T12:00:00.000Z',
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      readText: jest.fn(),
      writeText: jest.fn().mockResolvedValue(undefined),
    },
  });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('profile signer ownership verification', () => {
  it('preserves unsaved hospitality edits when ownership verification succeeds', async () => {
    const extension = signer();
    adapters.getNip07Signer.mockReturnValue(extension);
    renderPage();
    fireEvent.change(screen.getByLabelText('bewelcome.org/members/'), {
      target: { value: 'unsaved-member' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with browser extension',
      }),
    );
    await waitFor(() => expect(api.verifyNostrKey).toHaveBeenCalledWith(event));
    expect(
      await screen.findAllByText('Nostr key ownership verified.'),
    ).not.toHaveLength(0);
    expect(screen.getByLabelText('bewelcome.org/members/')).toHaveValue(
      'unsaved-member',
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('requires signing support and never requests a challenge without it', async () => {
    renderPage();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with browser extension',
      }),
    );
    expect(
      await screen.findByText(
        'A NIP-07 extension with signing support was not found.',
      ),
    ).toBeVisible();
    expect(api.createNostrVerificationChallenge).not.toHaveBeenCalled();
  });

  it('rejects a different signer key before requesting a challenge', async () => {
    adapters.getNip07Signer.mockReturnValue(
      signer({ getPublicKey: jest.fn().mockResolvedValue('d'.repeat(64)) }),
    );
    renderPage();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with browser extension',
      }),
    );
    expect(
      await screen.findByText(
        'The signer key does not match the saved profile key.',
      ),
    ).toBeVisible();
    expect(api.createNostrVerificationChallenge).not.toHaveBeenCalled();
  });

  it('does not submit a malformed signer event', async () => {
    adapters.getNip07Signer.mockReturnValue(
      signer({ signEvent: jest.fn().mockResolvedValue({}) }),
    );
    renderPage();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with browser extension',
      }),
    );
    expect(
      await screen.findByText('The signer returned an invalid signed event.'),
    ).toBeVisible();
    expect(api.verifyNostrKey).not.toHaveBeenCalled();
  });

  it('shows challenge errors without changing the linked key', async () => {
    adapters.getNip07Signer.mockReturnValue(signer());
    api.createNostrVerificationChallenge.mockRejectedValueOnce({
      response: { data: { message: 'Verification unavailable.' } },
    });
    renderPage();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with browser extension',
      }),
    );
    expect(await screen.findByText('Verification unavailable.')).toBeVisible();
    expect(screen.getByLabelText('nostr npub')).toHaveValue(npub);
  });

  it('requires saving a changed key before offering verification', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('nostr npub'), {
      target: { value: `npub1${'d'.repeat(64)}` },
    });
    expect(
      screen.queryByRole('button', {
        name: 'Verify saved key with browser extension',
      }),
    ).not.toBeInTheDocument();
  });

  it('shows persisted verification without asking a signer again', () => {
    renderPage({ nostrVerifiedAt: '2026-10-11T12:00:00.000Z' });
    expect(screen.getByText('Nostr key ownership verified.')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Verify saved key with NIP-46' }),
    ).not.toBeInTheDocument();
  });
});

describe('Android signer handoffs', () => {
  it('restores the draft and suggests a callback public key without saving', async () => {
    callback(publicKey);
    renderPage();
    expect(
      await screen.findByRole('button', { name: 'Replace with this npub' }),
    ).toBeVisible();
    expect(screen.getByLabelText('bewelcome.org/members/')).toHaveValue(
      'unsaved-member',
    );
    expect(window.location.search).toBe('');
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
    expect(api.update).not.toHaveBeenCalled();
  });

  it.each([
    ['another member', { userId: 'member-2' }, 'operation-1'],
    ['an expired operation', { expiresAt: 1 }, 'operation-1'],
    ['another operation', {}, 'operation-2'],
  ])(
    'rejects a callback for %s and scrubs its URL',
    async (_label, options, operation) => {
      callback(publicKey, options, operation);
      renderPage();
      await waitFor(() => expect(window.location.search).toBe(''));
      expect(
        screen.queryByRole('button', { name: 'Replace with this npub' }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText('bewelcome.org/members/')).toHaveValue('');
      if (operation === 'operation-2') {
        expect(JSON.parse(sessionStorage.getItem(pendingKey)!)).toMatchObject({
          operationId: 'operation-1',
        });
      } else {
        expect(sessionStorage.getItem(pendingKey)).toBeNull();
      }
      expect(api.verifyNostrKey).not.toHaveBeenCalled();
    },
  );

  it('ignores unsolicited callbacks without pending state', async () => {
    window.history.replaceState(
      {},
      '',
      '/profile/edit/networks?nostrOperation=unknown&nostrResult=untrusted',
    );
    renderPage();
    expect(
      await screen.findByText('There is no pending Android signer request.'),
    ).toBeVisible();
    expect(window.location.search).toBe('');
    expect(api.verifyNostrKey).not.toHaveBeenCalled();
  });

  it('verifies a correlated signed callback while preserving its draft', async () => {
    callback(event, { purpose: 'verify' });
    renderPage();
    await waitFor(() => expect(api.verifyNostrKey).toHaveBeenCalledWith(event));
    expect(
      await screen.findAllByText('Nostr key ownership verified.'),
    ).not.toHaveLength(0);
    expect(screen.getByLabelText('bewelcome.org/members/')).toHaveValue(
      'unsaved-member',
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('rejects a public key returned to a signing request', async () => {
    callback(publicKey, { purpose: 'verify' });
    renderPage();
    expect(
      await screen.findByText(
        'The Android signer did not return a signed event.',
      ),
    ).toBeVisible();
    expect(api.verifyNostrKey).not.toHaveBeenCalled();
  });

  it('lets the member explicitly import a clipboard response', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    jest.mocked(navigator.clipboard.readText).mockResolvedValue(publicKey);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Import NIP-55 result from clipboard',
      }),
    );
    expect(
      await screen.findByRole('button', { name: 'Replace with this npub' }),
    ).toBeVisible();
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
  });

  it('cancels a pending Android request without changing the draft', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    expect(sessionStorage.getItem(pendingKey)).not.toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel Android signer request' }),
    );
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
    expect(screen.getByText('Android signer request cancelled.')).toBeVisible();
    expect(screen.getByLabelText('nostr npub')).toHaveValue(npub);
  });

  it('expires abandoned Android imports and clears pending state', async () => {
    jest.useFakeTimers();
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    await act(async () => {
      jest.advanceTimersByTime(120_000);
    });
    expect(
      screen.getByText('The Android signer request expired. Please try again.'),
    ).toBeVisible();
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
  });

  it('reports errors starting verification without opening a signer', async () => {
    api.createNostrVerificationChallenge.mockRejectedValueOnce({
      response: { data: { message: 'Save the key first.' } },
    });
    renderPage();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with Android signer',
      }),
    );
    expect(await screen.findByText('Save the key first.')).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Open in Android signer' }),
    ).not.toBeInTheDocument();
  });

  it('discards corrupt pending state on arrival', () => {
    sessionStorage.setItem(pendingKey, '{invalid-json');
    renderPage();
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
  });
});

describe('signer failures and explicit imports', () => {
  it.each([undefined, {}])(
    'reports an unavailable extension (%s)',
    async extension => {
      window.nostr = extension;
      renderPage();
      fireEvent.click(
        screen.getByRole('button', { name: 'Use browser extension' }),
      );
      expect(
        await screen.findByText('A NIP-07 browser extension was not found.'),
      ).toBeVisible();
    },
  );

  it('explicitly imports a browser key without saving it', async () => {
    window.nostr = { getPublicKey: jest.fn().mockResolvedValue(publicKey) };
    renderPage({ nostrNpub: '' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Use browser extension' }),
    );
    expect(
      await screen.findByText(
        'Review the suggested npub and choose Use this npub.',
      ),
    ).toBeVisible();
    expect(screen.getByLabelText('nostr npub')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Use this npub' }));
    expect(screen.getByLabelText('nostr npub')).toHaveValue(npub);
  });

  it.each([new Error('Extension denied access.'), null])(
    'reports extension failures (%s)',
    async error => {
      window.nostr = { getPublicKey: jest.fn().mockRejectedValue(error) };
      renderPage();
      fireEvent.click(
        screen.getByRole('button', { name: 'Use browser extension' }),
      );
      expect(
        await screen.findByText(
          error instanceof Error
            ? error.message
            : 'Could not read a key from the browser extension.',
        ),
      ).toBeVisible();
    },
  );

  it.each(['invalid-hex', 'npub1invalid'])(
    'rejects malformed signer keys (%s)',
    async value => {
      callback(value);
      renderPage();
      expect(
        await screen.findByText('The signer returned an invalid public key.'),
      ).toBeVisible();
    },
  );

  it('rejects a decoded secret key masquerading as a public-key result', async () => {
    jest
      .mocked(nip19.decode)
      .mockReturnValueOnce({ type: 'nsec', data: new Uint8Array(32) });
    callback('npub1invalid');
    renderPage();
    expect(
      await screen.findByText('The signer returned an invalid public key.'),
    ).toBeVisible();
  });

  it('accepts an encoded public key returned by an Android signer', async () => {
    callback(npub);
    renderPage();
    expect(
      await screen.findByRole('button', { name: 'Replace with this npub' }),
    ).toBeVisible();
  });

  it('converts byte-backed NIP-19 public keys returned by Android signers', async () => {
    const bytes = new Uint8Array(32).fill(0xaa);
    jest.mocked(nip19.decode).mockReturnValueOnce({
      type: 'npub',
      data: bytes,
    } as unknown as ReturnType<typeof nip19.decode>);
    callback(`npub1${'a'.repeat(64)}`);
    renderPage();
    expect(
      await screen.findByText(
        'Review the suggested npub and choose Use this npub.',
      ),
    ).toBeVisible();
    expect(screen.getByText(`npub1${'aa'.repeat(32)}`)).toBeVisible();
  });

  it('waits for the member id to hydrate before consuming an Android callback', async () => {
    callback(npub);
    const unhydrated = { ...user, _id: undefined } as unknown as UserProfile;
    const bootstrapData = {
      env: 'test' as const,
      isNativeMobileApp: false,
      settings: {},
      title: 'Trustroots',
      user: unhydrated,
    };
    const view = render(
      <AppProviders bootstrapData={bootstrapData}>
        <ProfileEditNetworks user={unhydrated} />
      </AppProviders>,
    );
    expect(sessionStorage.getItem(pendingKey)).not.toBeNull();
    expect(window.location.search).toContain('nostrOperation=operation-1');
    view.rerender(
      <AppProviders bootstrapData={{ ...bootstrapData, user }}>
        <ProfileEditNetworks user={user} />
      </AppProviders>,
    );
    expect(
      await screen.findByText(
        'Review the suggested npub and choose Use this npub.',
      ),
    ).toBeVisible();
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
    expect(window.location.search).not.toContain('nostrOperation');
  });

  it('uses a non-empty result when Android appends beside the callback placeholder', async () => {
    callback(npub);
    const url = new URL(window.location.href);
    url.searchParams.set('nostrResult', '');
    url.searchParams.append('nostrResult', npub);
    window.history.replaceState({}, '', url.toString());
    renderPage();
    expect(
      await screen.findByText(
        'Review the suggested npub and choose Use this npub.',
      ),
    ).toBeVisible();
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
  });

  it('accepts a public key returned in an Android result object', async () => {
    callback({ pubkey: publicKey });
    renderPage();
    expect(
      await screen.findByRole('button', { name: 'Replace with this npub' }),
    ).toBeVisible();
  });

  it.each([{}, 42, null])(
    'rejects invalid Android result objects (%s)',
    async result => {
      callback(result);
      renderPage();
      expect(
        await screen.findByText(
          'The Android signer returned an invalid public key.',
        ),
      ).toBeVisible();
    },
  );

  it.each([new Error('Clipboard denied.'), null])(
    'reports clipboard access failures (%s)',
    async error => {
      renderPage();
      fireEvent.click(
        screen.getByRole('button', { name: 'Use Android signer' }),
      );
      jest.mocked(navigator.clipboard.readText).mockRejectedValueOnce(error);
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Import NIP-55 result from clipboard',
        }),
      );
      expect(
        await screen.findByText(
          error instanceof Error
            ? error.message
            : 'Could not import the Android signer result.',
        ),
      ).toBeVisible();
    },
  );

  it('does not process partial callback URLs', () => {
    window.history.replaceState(
      {},
      '',
      '/profile/edit/networks?nostrOperation=only-id',
    );
    renderPage();
    expect(window.location.search).toBe('');
    expect(api.verifyNostrKey).not.toHaveBeenCalled();
  });

  it('starts Android verification with the saved key and cleans up repeated requests', async () => {
    jest.useFakeTimers();
    const view = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy signer request' }),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with Android signer',
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(adapters.buildNip55Uri).toHaveBeenLastCalledWith(
      'sign_event',
      expect.any(String),
      event,
      publicKey,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with Android signer',
      }),
    );
    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(120_000);
    });
    expect(
      screen.getByText('The Android signer request expired. Please try again.'),
    ).toBeVisible();
    view.unmount();
  });

  it('clears a pending Android timer on departure', () => {
    const view = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    view.unmount();
  });

  it('cancels a request after its expiry timer has already cleared it', async () => {
    jest.useFakeTimers();
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    const cancel = screen.getByRole('button', {
      name: 'Cancel Android signer request',
    });
    await act(async () => {
      jest.advanceTimersByTime(120_000);
    });
    fireEvent.click(cancel);
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
  });

  it('rejects a saved key that the decoder cannot represent as a public key', async () => {
    jest
      .mocked(nip19.decode)
      .mockReturnValueOnce({ type: 'nsec', data: new Uint8Array(32) });
    renderPage();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with Android signer',
      }),
    );
    expect(
      await screen.findByText('The saved Nostr public key is invalid.'),
    ).toBeVisible();
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
  });

  it('keeps the key unverified when the server response has no verification timestamp', async () => {
    api.verifyNostrKey.mockResolvedValueOnce({ ...user });
    adapters.getNip07Signer.mockReturnValue(signer());
    renderPage();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with browser extension',
      }),
    );
    await waitFor(() => expect(api.verifyNostrKey).toHaveBeenCalled());
    expect(
      screen.queryByText('Nostr key ownership verified.'),
    ).not.toBeInTheDocument();
  });

  it('keeps an Android-returned key unverified without server confirmation', async () => {
    api.verifyNostrKey.mockResolvedValueOnce({ ...user });
    callback(event, { purpose: 'verify' });
    renderPage();
    await waitFor(() => expect(api.verifyNostrKey).toHaveBeenCalled());
    expect(
      screen.queryByText('Nostr key ownership verified.'),
    ).not.toBeInTheDocument();
  });

  it('reports an unstructured Android verification failure after callback', async () => {
    api.verifyNostrKey.mockRejectedValueOnce(null);
    callback(event, { purpose: 'verify' });
    renderPage();
    expect(
      await screen.findByText('Could not import the Android signer result.'),
    ).toBeVisible();
  });

  it('handles Android verification rejection without a server message', async () => {
    api.createNostrVerificationChallenge.mockRejectedValueOnce(null);
    renderPage();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with Android signer',
      }),
    );
    expect(
      await screen.findByText('Could not start key verification.'),
    ).toBeVisible();
  });

  it('handles signer rejection without an Error object', async () => {
    adapters.getNip07Signer.mockReturnValue(
      signer({ signEvent: jest.fn().mockRejectedValue(null) }),
    );
    renderPage();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with browser extension',
      }),
    );
    expect(
      await screen.findByText('Could not verify the saved key.'),
    ).toBeVisible();
  });

  it('clears an Android request without an expiry timestamp', () => {
    sessionStorage.setItem(pendingKey, JSON.stringify({ userId: user._id }));
    renderPage();
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
  });
});

describe('remote signer pairing and authentication', () => {
  it('aborts an in-flight pairing when leaving the editor', async () => {
    adapters.connectBunkerSigner.mockReturnValueOnce(
      new Promise(() => undefined),
    );
    const view = renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );
    const signal = adapters.connectBunkerSigner.mock.calls[0][3];
    view.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(signal.aborted).toBe(true);
  });
  it('offers generated QR/copy/open pairing and cleans up cancellation', async () => {
    adapters.connectNostrConnectSigner.mockReturnValueOnce(
      new Promise(() => undefined),
    );
    const view = renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Show Nostr Connect QR' }),
    );
    expect(await screen.findByAltText('Nostr Connect QR')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Open in signer' }),
    ).toHaveAttribute('href', expect.stringContaining('nostrconnect:'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy connection URI' }),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    const secret =
      adapters.buildNostrConnectUri.mock.results[0].value.secretKey;
    fireEvent.click(screen.getByRole('button', { name: 'Cancel connection' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(Array.from(secret)).toEqual(Array(32).fill(0));
    view.unmount();
  });

  it('closes a signer that resolves as its pairing is cancelled', async () => {
    let resolveConnection!: (value: signers.NostrSigner) => void;
    const remote = signer();
    adapters.connectNostrConnectSigner.mockReturnValueOnce(
      new Promise(resolve => {
        resolveConnection = resolve;
      }),
    );
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Show Nostr Connect QR' }),
    );
    await screen.findByAltText('Nostr Connect QR');
    act(() => {
      resolveConnection(remote);
      fireEvent.click(
        screen.getByRole('button', { name: 'Cancel connection' }),
      );
    });
    await waitFor(() => expect(remote.close).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByText('NIP-46 signer connected.'),
    ).not.toBeInTheDocument();
  });

  it('verifies through generated pairing when no connection exists', async () => {
    adapters.connectNostrConnectSigner.mockResolvedValueOnce(signer());
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Verify saved key with NIP-46' }),
    );
    await waitFor(() => expect(api.verifyNostrKey).toHaveBeenCalledWith(event));
    expect(
      await screen.findByText('Nostr key ownership verified.'),
    ).toBeVisible();
  });

  it('lets the member disconnect an established signer', async () => {
    const remote = signer();
    adapters.connectBunkerSigner.mockResolvedValueOnce(remote);
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Disconnect NIP-46 signer' }),
    );
    expect(remote.close).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['https://signer.example.com/approve', true],
    ['https://name@signer.example.com/', false],
    ['https://:password@signer.example.com/', false],
    ['http://signer.example.com/', false],
    ['invalid-url', false],
  ])('validates signer authentication URLs (%s)', async (url, allowed) => {
    adapters.connectBunkerSigner.mockImplementationOnce(
      async (_input, _relays, auth) => {
        auth(url);
        return signer();
      },
    );
    renderPage();
    fireEvent.change(screen.getByLabelText('NIP-46 relay'), {
      target: { value: 'wss://chosen.example.com' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );
    await screen.findByText('NIP-46 signer connected.');
    expect(
      Boolean(
        screen.queryByRole('link', { name: 'Continue signer authentication' }),
      ),
    ).toBe(allowed);
    expect(adapters.connectBunkerSigner).toHaveBeenCalledWith(
      '',
      ['wss://chosen.example.com'],
      expect.any(Function),
      expect.any(AbortSignal),
    );
  });

  it('times out a signer that never completes pairing', async () => {
    jest.useFakeTimers();
    adapters.connectBunkerSigner.mockReturnValueOnce(
      new Promise(() => undefined),
    );
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );
    await act(async () => {
      jest.advanceTimersByTime(120_000);
    });
    expect(
      screen.getByText('NIP-46 connection timed out or was cancelled.'),
    ).toBeVisible();
  });

  it('shows a generic message for a non-Error connection rejection', async () => {
    adapters.connectBunkerSigner.mockRejectedValueOnce(null);
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );
    expect(
      await screen.findByText('Could not connect to the NIP-46 signer.'),
    ).toBeVisible();
  });

  it('keeps a connected signer available after signing is rejected', async () => {
    const remote = signer({
      signEvent: jest.fn().mockRejectedValue(new Error('Signing rejected.')),
    });
    adapters.connectBunkerSigner.mockResolvedValueOnce(remote);
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );
    await screen.findByText('NIP-46 signer connected.');
    fireEvent.click(
      screen.getByRole('button', { name: 'Verify saved key with NIP-46' }),
    );
    expect(await screen.findByText('Signing rejected.')).toBeVisible();
    expect(remote.close).not.toHaveBeenCalled();
  });

  it('cancels verification when an established signer stops responding', async () => {
    jest.useFakeTimers();
    const remote = signer({
      signEvent: jest.fn().mockReturnValue(new Promise(() => undefined)),
    });
    adapters.connectBunkerSigner.mockResolvedValueOnce(remote);
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Verify saved key with NIP-46' }),
    );
    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(120_000);
    });
    expect(
      screen.getByText('NIP-46 connection timed out or was cancelled.'),
    ).toBeVisible();
    expect(remote.close).toHaveBeenCalled();
  });

  it('ignores a late active-signer verification rejection after cancellation', async () => {
    let rejectPublicKey!: (reason: Error) => void;
    const remote = signer({
      getPublicKey: jest
        .fn()
        .mockResolvedValueOnce(publicKey)
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectPublicKey = reject;
            }),
        ),
    });
    adapters.connectBunkerSigner.mockResolvedValueOnce(remote);
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );
    await screen.findByText('NIP-46 signer connected.');
    fireEvent.click(
      screen.getByRole('button', { name: 'Verify saved key with NIP-46' }),
    );
    await waitFor(() => expect(rejectPublicKey).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel connection' }));
    await act(async () => {
      rejectPublicKey(new Error('Late rejection.'));
      await Promise.resolve();
    });
    expect(screen.queryByText('Late rejection.')).not.toBeInTheDocument();
    expect(remote.close).toHaveBeenCalledTimes(1);
  });

  it('shows a generic message for non-Error signing rejection', async () => {
    const remote = signer({ signEvent: jest.fn().mockRejectedValue(null) });
    adapters.connectBunkerSigner.mockResolvedValueOnce(remote);
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );
    await screen.findByText('NIP-46 signer connected.');
    fireEvent.click(
      screen.getByRole('button', { name: 'Verify saved key with NIP-46' }),
    );
    expect(
      await screen.findByText('Could not verify the saved key.'),
    ).toBeVisible();
  });
});

describe('remote signer lifecycle', () => {
  it('reuses the connected signer for verification and closes it on departure', async () => {
    const remote = signer();
    adapters.connectBunkerSigner.mockResolvedValueOnce(remote);
    const view = renderPage();
    fireEvent.change(screen.getByLabelText('NIP-46 bunker URI'), {
      target: { value: `bunker://${publicKey}?relay=wss://relay.example.com` },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );
    await screen.findByText('NIP-46 signer connected.');
    fireEvent.change(screen.getByLabelText('bewelcome.org/members/'), {
      target: { value: 'unsaved-member' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Verify saved key with NIP-46' }),
    );
    await waitFor(() => expect(api.verifyNostrKey).toHaveBeenCalledWith(event));
    expect(adapters.connectBunkerSigner).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('bewelcome.org/members/')).toHaveValue(
      'unsaved-member',
    );
    view.unmount();
    expect(remote.close).toHaveBeenCalledTimes(1);
  });

  it('cancels pending bunker pairing and preserves draft values', async () => {
    adapters.connectBunkerSigner.mockImplementationOnce(
      (_input, _relays, _auth, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener(
            'abort',
            () => reject(new Error('Cancelled')),
            { once: true },
          ),
        ),
    );
    renderPage({ extSitesBW: 'unsaved-member' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Cancel connection' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Cancel connection' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText('bewelcome.org/members/')).toHaveValue(
      'unsaved-member',
    );
    expect(api.update).not.toHaveBeenCalled();
  });
});
