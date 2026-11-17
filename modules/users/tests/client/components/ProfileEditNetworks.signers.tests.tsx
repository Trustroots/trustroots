import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { nip19 } from 'nostr-tools';

import { AppProviders } from '@/layers/shell/client/AppProviders';
import ProfileEditNetworks from '@/modules/users/client/components/ProfileEditNetworks.component';
import * as usersApi from '@/modules/users/client/api/users.api';
import * as signers from '@/modules/users/client/services/nostr-signers.client';
import type { UserProfile } from '@/modules/users/client/types';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';

const analytics = fakeAnalytics();

jest.mock('@/modules/users/client/api/users.api');
jest.mock('@/modules/users/client/services/nostr-signers.client', () => ({
  buildNip55Uri: jest.fn(
    (method: string, id: string) => `nostrsigner:?type=${method}&id=${id}`,
  ),
  buildNostrConnectUri: jest.fn(),
  connectBunkerSigner: jest.fn(),
  connectNostrConnectSigner: jest.fn(),
  DEFAULT_NOSTR_RELAY: 'wss://relay.example.com',
  isSignedNostrEvent: jest.fn((value: unknown) =>
    Boolean(value && typeof value === 'object' && 'sig' in value),
  ),
  NOSTR_SIGNER_TIMEOUT_MS: 120_000,
  parseNip55Result: jest.fn((value: string) => {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }),
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
};
const unsignedEvent = {
  kind: 27235,
  content: '',
  created_at: 1,
  tags: [['challenge', 'fictional-nonce']],
};
const signedEvent = {
  ...unsignedEvent,
  id: 'b'.repeat(64),
  sig: 'c'.repeat(128),
  pubkey: publicKey,
};
const pendingKey = 'trustroots.nostr.pending';

function renderPage(profile: UserProfile = user) {
  return render(
    <AppProviders
      analyticsTracker={analytics.tracker}
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

function setAndroidCallback(
  result: unknown,
  purpose: 'import' | 'sign' = 'sign',
) {
  sessionStorage.setItem(
    pendingKey,
    JSON.stringify({
      operationId: 'operation-1',
      userId: user._id,
      expiresAt: Date.now() + 60_000,
      purpose,
      draft: { nostrNpub: npub, extSitesBW: 'fictional-member' },
    }),
  );
  const url = new URL('/profile/edit/networks', window.location.origin);
  url.searchParams.set('nostrOperation', 'operation-1');
  url.searchParams.set(
    'nostrResult',
    typeof result === 'string' ? result : JSON.stringify(result),
  );
  window.history.replaceState({}, '', url.toString());
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/profile/edit/networks');
  api.nostrChallenge.mockResolvedValue(unsignedEvent);
  api.update.mockResolvedValue({ ...user, nostrNpub: npub });
  adapters.buildNostrConnectUri.mockReturnValue({
    uri: 'nostrconnect://fixture?relay=wss://relay.example.com&secret=fixture',
    secretKey: new Uint8Array(32).fill(1),
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { readText: jest.fn(), writeText: jest.fn() },
  });
});

describe('profile signer proof on save', () => {
  it('uses the connected NIP-46 signer to sign the profile update challenge', async () => {
    const signer: signers.NostrSigner = {
      getPublicKey: jest.fn().mockResolvedValue(publicKey),
      signEvent: jest.fn().mockResolvedValue(signedEvent),
      close: jest.fn().mockResolvedValue(undefined),
    };
    adapters.connectBunkerSigner.mockResolvedValue(signer);

    renderPage();
    fireEvent.change(screen.getByLabelText('NIP-46 bunker URI'), {
      target: { value: 'bunker://fictional' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );
    expect(await screen.findByText(npub)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Use this npub' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(
        expect.objectContaining({ nostrNpub: npub, nostrProof: signedEvent }),
      ),
    );
    expect(api.nostrChallenge).toHaveBeenCalledWith(npub);
    expect(signer.signEvent).toHaveBeenCalledWith(unsignedEvent);
  });

  it('sends a NIP-55 signing request and saves its correlated signed proof', async () => {
    const view = renderPage();
    fireEvent.change(screen.getByLabelText('nostr npub'), {
      target: { value: npub },
    });
    fireEvent.change(screen.getByLabelText('Signing method'), {
      target: { value: 'nip55' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(adapters.buildNip55Uri).toHaveBeenCalled());
    expect(api.nostrChallenge).toHaveBeenCalledWith(npub);
    expect(adapters.buildNip55Uri).toHaveBeenCalledWith(
      'sign_event',
      expect.any(String),
      unsignedEvent,
      publicKey,
    );
    expect(JSON.parse(sessionStorage.getItem(pendingKey)!)).toMatchObject({
      purpose: 'sign',
      draft: { nostrNpub: npub },
    });

    view.unmount();
    setAndroidCallback(signedEvent);
    renderPage();

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith(
        expect.objectContaining({ nostrNpub: npub, nostrProof: signedEvent }),
      ),
    );
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
  });

  it('rejects a connected signer whose public key does not match the draft npub', async () => {
    const signer: signers.NostrSigner = {
      getPublicKey: jest.fn().mockResolvedValue('d'.repeat(64)),
      signEvent: jest.fn().mockResolvedValue(signedEvent),
      close: jest.fn().mockResolvedValue(undefined),
    };
    adapters.connectBunkerSigner.mockResolvedValue(signer);

    renderPage();
    fireEvent.change(screen.getByLabelText('NIP-46 bunker URI'), {
      target: { value: 'bunker://fictional' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );
    await screen.findByText(`npub1${'d'.repeat(64)}`);
    fireEvent.change(screen.getByLabelText('nostr npub'), {
      target: { value: npub },
    });
    fireEvent.change(screen.getByLabelText('Signing method'), {
      target: { value: 'connected' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(
        'The signer public key does not match this npub.',
      ),
    ).toBeVisible();
    expect(api.nostrChallenge).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('does not save an Android response that is not a signed event', async () => {
    setAndroidCallback({ npub: publicKey });
    renderPage();

    expect(
      await screen.findByText(
        'The Android signer did not return a signed event.',
      ),
    ).toBeVisible();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('imports an Android public key as a suggestion without saving it', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    jest
      .mocked(navigator.clipboard.readText)
      .mockResolvedValue(JSON.stringify({ pubkey: publicKey }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Import NIP-55 result from clipboard',
      }),
    );

    expect(
      await screen.findByRole('button', { name: 'Use this npub' }),
    ).toBeVisible();
    expect(screen.getByLabelText('nostr npub')).toHaveValue('');
    expect(api.nostrChallenge).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('accepts an npub string returned by Android without treating it as hex', async () => {
    setAndroidCallback(npub, 'import');
    renderPage();

    expect(
      await screen.findByRole('button', { name: 'Use this npub' }),
    ).toBeVisible();
    expect(screen.getByText(npub)).toBeVisible();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('rejects a decoded Android result that is not an npub', async () => {
    setAndroidCallback(publicKey, 'import');
    jest.mocked(nip19.decode).mockReturnValueOnce({
      type: 'nsec',
      data: new Uint8Array(32),
    } as unknown as ReturnType<typeof nip19.decode>);
    renderPage();

    expect(
      await screen.findByText(
        'The Android signer returned an invalid public key.',
      ),
    ).toBeVisible();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('reports unexpected Android parsing errors', async () => {
    setAndroidCallback(publicKey, 'import');
    adapters.parseNip55Result.mockImplementationOnce(() => {
      throw new Error('Unexpected response.');
    });
    renderPage();

    expect(
      await screen.findByText('Could not import the Android signer result.'),
    ).toBeVisible();
  });

  it('does not request a challenge when NIP-19 rejects the saved key', async () => {
    jest.mocked(nip19.decode).mockReturnValueOnce({
      type: 'nsec',
      data: new Uint8Array(32),
    } as unknown as ReturnType<typeof nip19.decode>);
    renderPage();
    fireEvent.change(screen.getByLabelText('nostr npub'), {
      target: { value: npub },
    });
    fireEvent.change(screen.getByLabelText('Signing method'), {
      target: { value: 'nip55' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Could not import the Android signer result.'),
    ).toBeVisible();
    expect(api.nostrChallenge).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('reports malformed Android import results and clipboard failures', async () => {
    setAndroidCallback(42, 'import');
    const view = renderPage();
    expect(
      await screen.findByText(
        'The Android signer returned an invalid public key.',
      ),
    ).toBeVisible();
    expect(api.update).not.toHaveBeenCalled();
    view.unmount();

    sessionStorage.clear();
    window.history.replaceState({}, '', '/profile/edit/networks');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    jest
      .mocked(navigator.clipboard.readText)
      .mockRejectedValueOnce(new Error('Clipboard denied.'));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Import NIP-55 result from clipboard',
      }),
    );

    expect(
      await screen.findByText('Could not import the Android signer result.'),
    ).toBeVisible();
  });
});
