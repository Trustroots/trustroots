import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import { AppProviders } from '@/layers/shell/client/AppProviders';
import ProfileEditNetworks from '@/modules/users/client/components/ProfileEditNetworks.component';
import * as usersApi from '@/modules/users/client/api/users.api';
import * as signers from '@/modules/users/client/services/nostr-signers.client';
import type { UserProfile } from '@/modules/users/client/types';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';

const analytics = fakeAnalytics();

jest.mock('@/modules/users/client/api/users.api');
jest.mock('@/modules/users/client/services/nostr-signers.client', () => ({
  buildNip55Uri: jest.fn((method: string, id: string) => `${method}:${id}`),
  buildNostrConnectUri: jest.fn(),
  connectBunkerSigner: jest.fn(),
  connectNostrConnectSigner: jest.fn(),
  DEFAULT_NOSTR_RELAY: 'wss://relay.example.com',
  isSignedNostrEvent: jest.fn(),
  NOSTR_SIGNER_TIMEOUT_MS: 120_000,
  parseNip55Result: jest.fn(),
}));
jest.mock('qrcode', () => ({
  __esModule: true,
  default: {
    toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,fake'),
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
const user: UserProfile = {
  _id: 'member-1',
  username: 'fictional-member',
  displayName: 'Fictional Member',
};
const pendingKey = 'trustroots.nostr.pending';

function renderPage() {
  return render(
    <AppProviders
      analyticsTracker={analytics.tracker}
      bootstrapData={{
        env: 'test',
        isNativeMobileApp: false,
        settings: {},
        title: 'Trustroots',
        user,
      }}
    >
      <ProfileEditNetworks user={user} />
    </AppProviders>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/profile/edit/networks');
  api.update.mockResolvedValue(user);
});

describe('ProfileEditNetworks signer lifecycle', () => {
  it('aborts an in-flight NIP-46 connection when the editor unmounts', async () => {
    let signal: AbortSignal | undefined;
    adapters.connectBunkerSigner.mockImplementation(
      (_uri, _relays, _authorise, operationSignal) => {
        signal = operationSignal;
        return new Promise((_resolve, reject) => {
          operationSignal.addEventListener(
            'abort',
            () => reject(new Error('aborted')),
            { once: true },
          );
        });
      },
    );

    const view = renderPage();
    fireEvent.change(screen.getByLabelText('NIP-46 bunker URI'), {
      target: { value: 'bunker://fictional' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );
    await waitFor(() => expect(signal).toBeDefined());

    view.unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('reports an unavailable signer result that is not an Error object', async () => {
    adapters.connectBunkerSigner.mockRejectedValueOnce(null);
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );

    expect(
      await screen.findByText('Could not connect to the NIP-46 signer.'),
    ).toBeVisible();
  });

  it('shows a Nostr Connect pairing and only accepts secure signer authorisation URLs', async () => {
    let finishConnection!: (value: signers.NostrSigner) => void;
    const connectedSigner: signers.NostrSigner = {
      getPublicKey: jest.fn().mockResolvedValue('a'.repeat(64)),
      signEvent: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    adapters.buildNostrConnectUri.mockReturnValue({
      uri: 'nostrconnect://fixture?relay=wss://relay.example.com&secret=fixture',
      secretKey: new Uint8Array(32).fill(1),
    });
    adapters.connectNostrConnectSigner.mockImplementation(
      (_uri, _secret, authorise) => {
        authorise('http://signer.example.com/approve');
        authorise('https://signer.example.com/approve');
        return new Promise(resolve => {
          finishConnection = resolve;
        });
      },
    );

    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Show Nostr Connect QR' }),
    );

    expect(
      await screen.findByAltText('Remote signer connection QR code'),
    ).toBeVisible();
    expect(screen.getByLabelText('Nostr Connect URI')).toHaveValue(
      'nostrconnect://fixture?relay=wss://relay.example.com&secret=fixture',
    );
    expect(
      screen.getByRole('link', { name: 'Authorise the remote signer' }),
    ).toHaveAttribute('href', 'https://signer.example.com/approve');
    expect(adapters.connectNostrConnectSigner).toHaveBeenCalled();
    finishConnection(connectedSigner);
  });

  it('stops a NIP-46 connection when its timeout expires', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    adapters.connectBunkerSigner.mockImplementation(
      (_uri, _relays, _authorise, operationSignal) => {
        signal = operationSignal;
        return new Promise((_resolve, reject) => {
          operationSignal.addEventListener(
            'abort',
            () => reject(new Error('aborted')),
            { once: true },
          );
        });
      },
    );

    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );
    await act(async () => {
      jest.advanceTimersByTime(120_000);
    });

    expect(signal?.aborted).toBe(true);
  });

  it('rejects an Android callback for another member and clears its URL', async () => {
    sessionStorage.setItem(
      pendingKey,
      JSON.stringify({
        operationId: 'operation-1',
        userId: 'another-member',
        expiresAt: Date.now() + 60_000,
        draft: { nostrNpub: 'npub1fictional' },
        purpose: 'import',
      }),
    );
    window.history.replaceState(
      {},
      '',
      '/profile/edit/networks?nostrOperation=operation-1&nostrResult=fictional',
    );

    renderPage();

    expect(
      await screen.findByText(
        'The Android signer response expired or belongs to another request.',
      ),
    ).toBeVisible();
    expect(window.location.search).toBe('');
    expect(screen.getByLabelText('nostr npub')).toHaveValue('');
    expect(api.update).not.toHaveBeenCalled();
  });

  it('ignores an Android callback when no matching request is pending', async () => {
    window.history.replaceState(
      {},
      '',
      '/profile/edit/networks?nostrOperation=operation-1&nostrResult=fictional',
    );

    renderPage();

    expect(
      await screen.findByText(
        'The Android signer response expired or belongs to another request.',
      ),
    ).toBeVisible();
    expect(window.location.search).toBe('');
    expect(api.update).not.toHaveBeenCalled();
  });

  it('clears a callback URL that has no operation id without processing it', () => {
    window.history.replaceState(
      {},
      '',
      '/profile/edit/networks?nostrResult=untrusted',
    );

    renderPage();

    expect(window.location.search).toBe('');
    expect(api.update).not.toHaveBeenCalled();
  });
});
