import React, { useState } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import * as QRCode from 'qrcode';
import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import { useAuth } from '@/modules/core/client/react-app/auth';
import * as authContext from '@/modules/core/client/react-app/auth';
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
  isSignedNostrEvent: jest.fn(),
  parseNip55Result: jest.fn(),
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
const profile: UserProfile = {
  _id: 'member-1',
  username: 'fictional-member',
  displayName: 'Fictional Member',
  nostrNpub: npub,
  nostrVerifiedAt: '2026-10-11T12:00:00.000Z',
};
const pendingKey = 'trustroots.nostr.pending';

function bootstrap(
  children: React.ReactNode,
  userOverride: UserProfile = { ...profile, nostrVerifiedAt: undefined },
) {
  return (
    <AppProviders
      bootstrapData={{
        env: 'test',
        isNativeMobileApp: false,
        settings: {},
        title: 'Trustroots',
        user: userOverride,
      }}
    >
      {children}
    </AppProviders>
  );
}

function AuthTimestamp() {
  const { user } = useAuth();
  return (
    <output data-testid="auth-verified-at">
      {String(user?.nostrVerifiedAt || '')}
    </output>
  );
}

function ChangeAuthNpub() {
  const { setUser } = useAuth();
  return (
    <button
      type="button"
      onClick={() =>
        setUser(current =>
          current
            ? { ...current, nostrNpub: `npub1${'d'.repeat(64)}` }
            : current,
        )
      }
    >
      Change auth npub
    </button>
  );
}

function Harness() {
  const [showEditor, setShowEditor] = useState(true);
  const { user } = useAuth();
  return (
    <>
      <AuthTimestamp />
      <ChangeAuthNpub />
      <button type="button" onClick={() => setShowEditor(value => !value)}>
        Toggle editor
      </button>
      {showEditor && user && <ProfileEditNetworks user={user as UserProfile} />}
    </>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/profile/edit/networks');
  api.update.mockResolvedValue({
    _id: profile._id,
    username: profile.username,
    displayName: profile.displayName,
    nostrNpub: `npub1${'d'.repeat(64)}`,
  });
  api.createNostrVerificationChallenge.mockResolvedValue({
    event: {
      kind: 27235,
      content: '',
      created_at: 1,
      tags: [],
    },
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  adapters.validateNostrRelays.mockImplementation(relays => relays);
  adapters.isSignedNostrEvent.mockReturnValue(true);
  adapters.parseNip55Result.mockImplementation(value => value);
  adapters.connectBunkerSigner.mockReset();
  adapters.getNip07Signer.mockReturnValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      readText: jest.fn().mockResolvedValue('fixture-result'),
      writeText: jest.fn().mockResolvedValue(undefined),
    },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('ProfileEditNetworks lifecycle regressions', () => {
  it('clears the auth-context verification timestamp after saving a different key, including on remount', async () => {
    render(bootstrap(<Harness />, profile));
    expect(screen.getByTestId('auth-verified-at')).toHaveTextContent(
      profile.nostrVerifiedAt!,
    );
    fireEvent.change(screen.getByLabelText('nostr npub'), {
      target: { value: `npub1${'d'.repeat(64)}` },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId('auth-verified-at')).toBeEmptyDOMElement(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Toggle editor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle editor' }));
    expect(
      screen.queryByText('Nostr key ownership verified.'),
    ).not.toBeInTheDocument();
  });

  it('does not let an earlier NIP-46 rejection cancel a newer attempt', async () => {
    const signals: AbortSignal[] = [];
    adapters.connectBunkerSigner.mockImplementation(
      (_uri, _relays, _auth, signal) => {
        signals.push(signal);
        return new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          }),
        );
      },
    );
    render(bootstrap(<ProfileEditNetworks user={profile} />));
    const connect = screen.getByRole('button', { name: 'Connect with NIP-46' });
    fireEvent.click(connect);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel connection' }));
    fireEvent.click(connect);
    await waitFor(() => expect(signals).toHaveLength(2));
    await act(async () => {
      await Promise.resolve();
    });
    expect(signals[1].aborted).toBe(false);
  });

  it('ignores authentication callbacks from a cancelled NIP-46 attempt', async () => {
    let onAuth!: (url: string) => void;
    adapters.connectBunkerSigner.mockImplementationOnce(
      (_uri, _relays, callback) => {
        onAuth = callback;
        return new Promise(() => undefined);
      },
    );
    render(bootstrap(<ProfileEditNetworks user={profile} />));
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with NIP-46' }),
    );
    await waitFor(() => expect(onAuth).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel connection' }));
    act(() => onAuth('https://signer.example.org/approve'));
    expect(
      screen.queryByRole('link', { name: 'Continue signer authentication' }),
    ).not.toBeInTheDocument();
  });

  it('ignores a verification response after the auth profile key changes', async () => {
    let resolveVerification!: (value: UserProfile) => void;
    api.verifyNostrKey.mockReturnValueOnce(
      new Promise(resolve => {
        resolveVerification = resolve;
      }),
    );
    adapters.getNip07Signer.mockReturnValue({
      getPublicKey: jest.fn().mockResolvedValue(publicKey),
      signEvent: jest.fn().mockResolvedValue({ sig: 'fixture' }),
      close: jest.fn().mockResolvedValue(undefined),
    });
    render(bootstrap(<Harness />, { ...profile, nostrVerifiedAt: undefined }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with browser extension',
      }),
    );
    await waitFor(() => expect(api.verifyNostrKey).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Change auth npub' }));
    await act(async () => {
      resolveVerification({
        ...profile,
        nostrVerifiedAt: '2026-10-11T12:30:00.000Z',
      });
      await Promise.resolve();
    });
    expect(screen.getByTestId('auth-verified-at')).toBeEmptyDOMElement();
    expect(
      screen.queryByText('Nostr key ownership verified.'),
    ).not.toBeInTheDocument();
  });

  it('does not update auth state if the key changes between verification checks', async () => {
    const unverifiedProfile = { ...profile, nostrVerifiedAt: undefined };
    const changedUser = {
      ...unverifiedProfile,
      nostrNpub: undefined,
    };
    let authUser: UserProfile = unverifiedProfile;
    let rerenderAuth!: () => void;
    const setUser = jest.fn() as unknown as ReturnType<
      typeof useAuth
    >['setUser'];
    (setUser as jest.Mock).mockImplementation(updateUser => {
      authUser =
        typeof updateUser === 'function' ? updateUser(changedUser) : updateUser;
      rerenderAuth();
    });
    jest.spyOn(authContext, 'useAuth').mockImplementation(() => ({
      user: authUser,
      isAuthenticated: true,
      hasRole: () => false,
      setUser,
    }));
    api.verifyNostrKey.mockResolvedValueOnce({
      ...unverifiedProfile,
      nostrVerifiedAt: '2026-10-11T12:45:00.000Z',
    });
    adapters.getNip07Signer.mockReturnValue({
      getPublicKey: jest.fn().mockResolvedValue(publicKey),
      signEvent: jest.fn().mockResolvedValue({ sig: 'fixture' }),
      close: jest.fn().mockResolvedValue(undefined),
    });
    function RaceHarness() {
      const [, forceRender] = useState(0);
      rerenderAuth = () => forceRender(value => value + 1);
      return <ProfileEditNetworks user={unverifiedProfile} />;
    }
    render(<RaceHarness />);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with browser extension',
      }),
    );
    await waitFor(() => expect(api.verifyNostrKey).toHaveBeenCalled());
    expect(setUser).toHaveBeenCalled();
    expect(
      screen.queryByText('Nostr key ownership verified.'),
    ).not.toBeInTheDocument();
  });

  it('does not verify when the authenticated profile has no saved npub', async () => {
    const unverifiedProfile = { ...profile, nostrVerifiedAt: undefined };
    const setUser = jest.fn() as unknown as ReturnType<
      typeof useAuth
    >['setUser'];
    jest.spyOn(authContext, 'useAuth').mockReturnValue({
      user: { ...unverifiedProfile, nostrNpub: undefined },
      isAuthenticated: true,
      hasRole: () => false,
      setUser,
    });
    adapters.getNip07Signer.mockReturnValue({
      getPublicKey: jest.fn().mockResolvedValue(publicKey),
      signEvent: jest.fn().mockResolvedValue({ sig: 'fixture' }),
      close: jest.fn().mockResolvedValue(undefined),
    });
    api.verifyNostrKey.mockResolvedValueOnce({
      ...unverifiedProfile,
      nostrVerifiedAt: '2026-10-11T12:45:00.000Z',
    });
    render(<ProfileEditNetworks user={unverifiedProfile} />);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with browser extension',
      }),
    );
    await waitFor(() => expect(api.verifyNostrKey).toHaveBeenCalled());
    expect(setUser).not.toHaveBeenCalled();
    expect(
      screen.queryByText('Nostr key ownership verified.'),
    ).not.toBeInTheDocument();
  });

  it('does not show a stale verification when auth already has a different timestamp', async () => {
    const unverifiedProfile = { ...profile, nostrVerifiedAt: undefined };
    let authUser: UserProfile = unverifiedProfile;
    let rerenderAuth!: () => void;
    const setUser = jest.fn() as unknown as ReturnType<
      typeof useAuth
    >['setUser'];
    (setUser as jest.Mock).mockImplementation(() => {
      authUser = {
        ...unverifiedProfile,
        nostrVerifiedAt: '2026-10-11T12:40:00.000Z',
      };
      rerenderAuth();
    });
    jest.spyOn(authContext, 'useAuth').mockImplementation(() => ({
      user: authUser,
      isAuthenticated: true,
      hasRole: () => false,
      setUser,
    }));
    api.verifyNostrKey.mockResolvedValueOnce({
      ...unverifiedProfile,
      nostrVerifiedAt: '2026-10-11T12:45:00.000Z',
    });
    adapters.getNip07Signer.mockReturnValue({
      getPublicKey: jest.fn().mockResolvedValue(publicKey),
      signEvent: jest.fn().mockResolvedValue({ sig: 'fixture' }),
      close: jest.fn().mockResolvedValue(undefined),
    });
    function RaceHarness() {
      const [, forceRender] = useState(0);
      rerenderAuth = () => forceRender(value => value + 1);
      return <ProfileEditNetworks user={unverifiedProfile} />;
    }
    render(<RaceHarness />);
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

  it('ignores a QR generated after its NIP-46 attempt was cancelled', async () => {
    let resolveQr!: () => void;
    adapters.buildNostrConnectUri.mockReturnValue({
      uri: 'nostrconnect://fixture?relay=wss://relay.example.com&secret=fixture',
      secretKey: new Uint8Array(32).fill(1),
    });
    (QRCode.toDataURL as jest.Mock).mockReturnValueOnce(
      new Promise<void>(resolve => {
        resolveQr = resolve;
      }),
    );
    render(bootstrap(<ProfileEditNetworks user={profile} />));
    fireEvent.click(
      screen.getByRole('button', { name: 'Show Nostr Connect QR' }),
    );
    await waitFor(() => expect(QRCode.toDataURL).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel connection' }));
    await act(async () => {
      resolveQr();
      await Promise.resolve();
    });
    expect(screen.queryByAltText('Nostr Connect QR')).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Nostr Connect URI'),
    ).not.toBeInTheDocument();
  });

  it('preserves a newer Android request when an older callback arrives', async () => {
    const next = {
      operationId: 'operation-b',
      userId: profile._id,
      expiresAt: Date.now() + 60_000,
      purpose: 'import',
      hasChanges: false,
      draft: {},
    };
    sessionStorage.setItem(pendingKey, JSON.stringify(next));
    const url = new URL('/profile/edit/networks', window.location.origin);
    url.searchParams.set('nostrOperation', 'operation-a');
    url.searchParams.set('nostrResult', 'old-result');
    window.history.replaceState({}, '', url.toString());
    const unverifiedProfile = { ...profile, nostrVerifiedAt: undefined };
    render(
      bootstrap(
        <AppProviders
          bootstrapData={{
            env: 'test',
            isNativeMobileApp: false,
            settings: {},
            title: 'Trustroots',
            user: unverifiedProfile,
          }}
        >
          <ProfileEditNetworks user={unverifiedProfile} />
        </AppProviders>,
      ),
    );
    expect(await screen.findByText(/belongs to another request/)).toBeVisible();
    expect(JSON.parse(sessionStorage.getItem(pendingKey)!).operationId).toBe(
      'operation-b',
    );
  });

  it('ignores an older Android timeout after a newer request is stored', async () => {
    const timers: Array<() => void> = [];
    const originalSetTimeout = window.setTimeout.bind(window);
    const setTimeoutSpy = jest.spyOn(window, 'setTimeout');
    setTimeoutSpy.mockImplementation(
      (handler: TimerHandler, timeout?: number) => {
        if (timeout === 120_000 && typeof handler === 'function') {
          timers.push(handler as () => void);
        }
        return originalSetTimeout(handler, timeout) as unknown as ReturnType<
          typeof window.setTimeout
        >;
      },
    );
    const unverifiedProfile = { ...profile, nostrVerifiedAt: undefined };
    render(
      bootstrap(
        <ProfileEditNetworks user={unverifiedProfile} />,
        unverifiedProfile,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    await waitFor(() => expect(timers).toHaveLength(1));
    const first = JSON.parse(sessionStorage.getItem(pendingKey)!);
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel Android signer request' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    await waitFor(() => expect(timers).toHaveLength(2));
    const second = JSON.parse(sessionStorage.getItem(pendingKey)!);
    expect(second.operationId).not.toBe(first.operationId);
    act(() => timers[0]());
    expect(JSON.parse(sessionStorage.getItem(pendingKey)!).operationId).toBe(
      second.operationId,
    );
    setTimeoutSpy.mockRestore();
  });

  it('ignores a timeout after its pending Android entry has already been removed', async () => {
    const timeoutHandlers: Array<() => void> = [];
    const originalSetTimeout = window.setTimeout.bind(window);
    const setTimeoutSpy = jest.spyOn(window, 'setTimeout');
    setTimeoutSpy.mockImplementation(
      (handler: TimerHandler, timeout?: number) => {
        if (timeout === 120_000 && typeof handler === 'function') {
          timeoutHandlers.push(handler as () => void);
        }
        return originalSetTimeout(handler, timeout) as unknown as ReturnType<
          typeof window.setTimeout
        >;
      },
    );
    render(
      bootstrap(
        <ProfileEditNetworks
          user={{ ...profile, nostrVerifiedAt: undefined }}
        />,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    await waitFor(() => expect(timeoutHandlers).toHaveLength(1));
    sessionStorage.removeItem(pendingKey);
    act(() => timeoutHandlers[0]());
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
    expect(
      screen.queryByText(
        'The Android signer request expired. Please try again.',
      ),
    ).not.toBeInTheDocument();
  });

  it('does not let an old verification timeout delete a newer Android request', async () => {
    const timeoutHandlers: Array<() => void> = [];
    const originalSetTimeout = window.setTimeout.bind(window);
    const setTimeoutSpy = jest.spyOn(window, 'setTimeout');
    setTimeoutSpy.mockImplementation(
      (handler: TimerHandler, timeout?: number) => {
        if (timeout === 120_000 && typeof handler === 'function') {
          timeoutHandlers.push(handler as () => void);
        }
        return originalSetTimeout(handler, timeout) as unknown as ReturnType<
          typeof window.setTimeout
        >;
      },
    );
    const unverifiedProfile = { ...profile, nostrVerifiedAt: undefined };
    render(
      bootstrap(
        <ProfileEditNetworks user={unverifiedProfile} />,
        unverifiedProfile,
      ),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with Android signer',
      }),
    );
    await waitFor(() =>
      expect(sessionStorage.getItem(pendingKey)).not.toBeNull(),
    );
    const oldOperation = JSON.parse(
      sessionStorage.getItem(pendingKey)!,
    ).operationId;
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel Android signer request' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    const nextOperation = JSON.parse(
      sessionStorage.getItem(pendingKey)!,
    ).operationId;
    expect(timeoutHandlers).toHaveLength(2);
    expect(nextOperation).not.toBe(oldOperation);
    act(() => timeoutHandlers[0]());
    expect(JSON.parse(sessionStorage.getItem(pendingKey)!).operationId).toBe(
      nextOperation,
    );
  });

  it('starts a fresh Android operation when stored state has no operation id', () => {
    const unverifiedProfile = { ...profile, nostrVerifiedAt: undefined };
    render(
      bootstrap(
        <ProfileEditNetworks user={unverifiedProfile} />,
        unverifiedProfile,
      ),
    );
    sessionStorage.setItem(
      pendingKey,
      JSON.stringify({ userId: profile._id, expiresAt: Date.now() + 60_000 }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    expect(
      JSON.parse(sessionStorage.getItem(pendingKey)!).operationId,
    ).toBeTruthy();
    expect(JSON.parse(sessionStorage.getItem(pendingKey)!).purpose).toBe(
      'import',
    );
  });

  it('expires the current Android request and clears its pending record', async () => {
    const timeoutHandlers: Array<() => void> = [];
    const originalSetTimeout = window.setTimeout.bind(window);
    const setTimeoutSpy = jest.spyOn(window, 'setTimeout');
    setTimeoutSpy.mockImplementation(
      (handler: TimerHandler, timeout?: number) => {
        if (timeout === 120_000 && typeof handler === 'function') {
          timeoutHandlers.push(handler as () => void);
        }
        return originalSetTimeout(handler, timeout) as unknown as ReturnType<
          typeof window.setTimeout
        >;
      },
    );
    const view = render(
      bootstrap(
        <ProfileEditNetworks
          user={{ ...profile, nostrVerifiedAt: undefined }}
        />,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    await waitFor(() => expect(timeoutHandlers).toHaveLength(1));
    act(() => timeoutHandlers[0]());
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
    expect(
      await screen.findByText(
        'The Android signer request expired. Please try again.',
      ),
    ).toBeVisible();
    view.unmount();
  });

  it('expires an Android verification request and clears its challenge', async () => {
    const timeoutHandlers: Array<() => void> = [];
    const originalSetTimeout = window.setTimeout.bind(window);
    const setTimeoutSpy = jest.spyOn(window, 'setTimeout');
    setTimeoutSpy.mockImplementation(
      (handler: TimerHandler, timeout?: number) => {
        if (timeout === 120_000 && typeof handler === 'function') {
          timeoutHandlers.push(handler as () => void);
        }
        return originalSetTimeout(handler, timeout) as unknown as ReturnType<
          typeof window.setTimeout
        >;
      },
    );
    const unverifiedProfile = { ...profile, nostrVerifiedAt: undefined };
    render(
      bootstrap(
        <ProfileEditNetworks user={unverifiedProfile} />,
        unverifiedProfile,
      ),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with Android signer',
      }),
    );
    await waitFor(() =>
      expect(sessionStorage.getItem(pendingKey)).not.toBeNull(),
    );
    expect(JSON.parse(sessionStorage.getItem(pendingKey)!).purpose).toBe(
      'verify',
    );
    expect(timeoutHandlers).toHaveLength(1);
    act(() => timeoutHandlers[0]());
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
    expect(
      await screen.findByText(
        'The Android signer request expired. Please try again.',
      ),
    ).toBeVisible();
    setTimeoutSpy.mockRestore();
  });

  it('ignores a challenge that resolves after a newer Android request starts', async () => {
    let resolveChallenge!: (
      value: Awaited<
        ReturnType<typeof usersApi.createNostrVerificationChallenge>
      >,
    ) => void;
    api.createNostrVerificationChallenge.mockReturnValueOnce(
      new Promise(resolve => {
        resolveChallenge = resolve;
      }),
    );
    render(
      bootstrap(
        <ProfileEditNetworks
          user={{ ...profile, nostrVerifiedAt: undefined }}
        />,
      ),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with Android signer',
      }),
    );
    await waitFor(() =>
      expect(api.createNostrVerificationChallenge).toHaveBeenCalled(),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel Android signer request' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    const pendingImport = JSON.parse(sessionStorage.getItem(pendingKey)!);
    await act(async () => {
      resolveChallenge({
        event: { kind: 27235, content: '', created_at: 1, tags: [] },
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
      await Promise.resolve();
    });
    expect(JSON.parse(sessionStorage.getItem(pendingKey)!).operationId).toBe(
      pendingImport.operationId,
    );
    expect(JSON.parse(sessionStorage.getItem(pendingKey)!).purpose).toBe(
      'import',
    );
  });

  it('does not show a stale challenge error after a newer Android operation starts', async () => {
    let rejectChallenge!: (reason: Error) => void;
    api.createNostrVerificationChallenge.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectChallenge = reject;
      }),
    );
    render(
      bootstrap(
        <ProfileEditNetworks
          user={{ ...profile, nostrVerifiedAt: undefined }}
        />,
      ),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with Android signer',
      }),
    );
    await waitFor(() =>
      expect(api.createNostrVerificationChallenge).toHaveBeenCalled(),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel Android signer request' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    await act(async () => {
      rejectChallenge(new Error('stale challenge failed'));
      await Promise.resolve();
    });
    expect(JSON.parse(sessionStorage.getItem(pendingKey)!).purpose).toBe(
      'import',
    );
    expect(
      screen.queryByText('stale challenge failed'),
    ).not.toBeInTheDocument();
  });

  it('clears an expired Android callback belonging to the current operation', async () => {
    const expired = {
      operationId: 'expired-operation',
      userId: profile._id,
      expiresAt: Date.now() - 1,
      purpose: 'import',
      hasChanges: false,
      draft: {},
    };
    sessionStorage.setItem(pendingKey, JSON.stringify(expired));
    const url = new URL('/profile/edit/networks', window.location.origin);
    url.searchParams.set('nostrOperation', expired.operationId);
    url.searchParams.set('nostrResult', 'expired-result');
    window.history.replaceState({}, '', url.toString());
    render(
      bootstrap(
        <ProfileEditNetworks
          user={{ ...profile, nostrVerifiedAt: undefined }}
        />,
      ),
    );
    expect(
      await screen.findByText('There is no pending Android signer request.'),
    ).toBeVisible();
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
  });

  it('discards malformed Android session data when the editor loads', () => {
    sessionStorage.setItem(pendingKey, '{malformed');
    render(bootstrap(<ProfileEditNetworks user={profile} />));
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
  });

  it('discards corrupt Android session data before starting a new request', () => {
    render(
      bootstrap(
        <ProfileEditNetworks
          user={{ ...profile, nostrVerifiedAt: undefined }}
        />,
      ),
    );
    sessionStorage.setItem(pendingKey, '{corrupt');
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    expect(JSON.parse(sessionStorage.getItem(pendingKey)!).purpose).toBe(
      'import',
    );
  });

  it('clears a clipboard result whose pending Android request belongs to another member', async () => {
    render(
      bootstrap(
        <ProfileEditNetworks
          user={{ ...profile, nostrVerifiedAt: undefined }}
        />,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    const pending = JSON.parse(sessionStorage.getItem(pendingKey)!);
    sessionStorage.setItem(
      pendingKey,
      JSON.stringify({ ...pending, userId: 'different-member' }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Import NIP-55 result from clipboard',
      }),
    );
    expect(await screen.findByText(/belongs to another request/)).toBeVisible();
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
  });

  it('reports when copying an Android signer request fails', async () => {
    jest
      .mocked(navigator.clipboard.writeText)
      .mockRejectedValueOnce(new Error('clipboard unavailable'));
    render(
      bootstrap(
        <ProfileEditNetworks
          user={{ ...profile, nostrVerifiedAt: undefined }}
        />,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use Android signer' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy signer request' }),
    );
    expect(
      await screen.findByText('Could not copy the signer request.'),
    ).toBeVisible();
  });

  it('does not persist a NIP-55 challenge that resolves after the editor unmounts', async () => {
    let resolveChallenge!: (
      value: Awaited<
        ReturnType<typeof usersApi.createNostrVerificationChallenge>
      >,
    ) => void;
    api.createNostrVerificationChallenge.mockReturnValueOnce(
      new Promise(resolve => {
        resolveChallenge = resolve;
      }),
    );
    const unverifiedProfile = { ...profile, nostrVerifiedAt: undefined };
    const view = render(
      <AppProviders
        bootstrapData={{
          env: 'test',
          isNativeMobileApp: false,
          settings: {},
          title: 'Trustroots',
          user: unverifiedProfile,
        }}
      >
        <ProfileEditNetworks user={unverifiedProfile} />
      </AppProviders>,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Verify saved key with Android signer',
      }),
    );
    await waitFor(() =>
      expect(api.createNostrVerificationChallenge).toHaveBeenCalled(),
    );
    view.unmount();
    await act(async () => {
      resolveChallenge({
        event: {
          kind: 27235,
          content: '',
          created_at: 1,
          tags: [],
        },
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
      await Promise.resolve();
    });
    expect(sessionStorage.getItem(pendingKey)).toBeNull();
  });
});
