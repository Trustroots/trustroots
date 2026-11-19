import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AppProviders } from '@/layers/shell/client/AppProviders';
import ProfileEditNetworks from '@/modules/users/client/components/ProfileEditNetworks.component';
import * as usersApi from '@/modules/users/client/api/users.api';
import { signWithConnectedNostr } from '@/modules/users/client/services/nostr-proof.client';
import type { UserProfile } from '@/modules/users/client/types';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';

const analytics = fakeAnalytics();

vi.mock('@/modules/users/client/services/nostr-proof.client', async () => ({
  ...(await vi.importActual<
    typeof import('@/modules/users/client/services/nostr-proof.client')
  >('@/modules/users/client/services/nostr-proof.client')),
  signNostrProof: vi.fn().mockResolvedValue({ id: 'signed-proof' }),
  signWithConnectedNostr: vi.fn(
    (
      await vi.importActual<
        typeof import('@/modules/users/client/services/nostr-proof.client')
      >('@/modules/users/client/services/nostr-proof.client')
    ).signWithConnectedNostr,
  ),
}));

const mockedUsersApi = vi.mocked(usersApi);

vi.mock('@/modules/users/client/api/users.api');
vi.mock('nostr-tools', async () => ({
  ...(await vi.importActual<typeof import('nostr-tools')>('nostr-tools')),
  nip19: {
    ...(await vi.importActual<typeof import('nostr-tools')>('nostr-tools'))
      .nip19,
    npubEncode: vi.fn(() => 'npub1suggestedkey'),
  },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { provider?: string }) =>
      values?.provider ? key.replace('{{provider}}', values.provider) : key,
  }),
}));
vi.mock('@/modules/users/client/components/ProfileEditPage.component', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <section>{children}</section>
  ),
}));

const user: UserProfile = {
  _id: 'user-1',
  username: 'ada',
  displayName: 'Ada Example',
};

function renderPage(overrides: Partial<UserProfile> = {}) {
  const profile = { ...user, ...overrides };

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

describe('ProfileEditNetworks', () => {
  it('shows remote authorisation while signing and cancels on unmount', async () => {
    const { signNostrProof } =
      await import('../../../client/services/nostr-proof.client');
    let signal: AbortSignal | undefined;
    vi.mocked(signNostrProof).mockImplementationOnce(
      (_event, _npub, _method, _uri, onAuth, operationSignal) => {
        signal = operationSignal;
        onAuth('https://signer.example.com/authorise');
        return new Promise(() => {});
      },
    );
    const view = renderPage();
    fireEvent.change(screen.getByLabelText('nostr npub'), {
      target: { value: 'npub1qqqq' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByRole('link', { name: 'Authorise the remote signer' }),
    ).toHaveAttribute('href', 'https://signer.example.com/authorise');
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
  it('saves a new key using a signed external challenge and keeps later network edits unsigned', async () => {
    mockedUsersApi.update.mockResolvedValue({
      ...user,
      nostrNpub: 'npub1qqqq',
    });
    renderPage();
    fireEvent.change(screen.getByLabelText('nostr npub'), {
      target: { value: 'npub1qqqq' },
    });
    fireEvent.change(screen.getByLabelText('Signing method'), {
      target: { value: 'external' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Create signing challenge' }),
    );
    expect(
      (await screen.findByLabelText<HTMLTextAreaElement>('Challenge to sign'))
        .value,
    ).toContain('27235');
    fireEvent.change(screen.getByLabelText('Signed event JSON'), {
      target: { value: '{"id":"external-proof"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(mockedUsersApi.update).toHaveBeenCalledWith(
        expect.objectContaining({
          nostrNpub: 'npub1qqqq',
          nostrProof: { id: 'external-proof' },
        }),
      ),
    );
    await screen.findByText('Hospitality networks updated.');
    expect(screen.queryByLabelText('Signing method')).not.toBeInTheDocument();
    mockedUsersApi.update.mockClear();
    mockedUsersApi.nostrChallenge.mockClear();
    fireEvent.change(screen.getByLabelText('couchers.org/user/'), {
      target: { value: 'fictional' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockedUsersApi.update).toHaveBeenCalledTimes(1));
    expect(mockedUsersApi.nostrChallenge).not.toHaveBeenCalled();
  });

  it('retains drafts when an external challenge request fails and clears proof when the key changes', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('nostr npub'), {
      target: { value: 'npub1qqqq' },
    });
    fireEvent.change(screen.getByLabelText('Signing method'), {
      target: { value: 'external' },
    });
    mockedUsersApi.nostrChallenge.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Create signing challenge' }),
    );
    expect(
      await screen.findByText('Something went wrong. Please try again!'),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Create signing challenge' }),
    );
    await screen.findByLabelText('Challenge to sign');
    fireEvent.change(screen.getByLabelText('Signed event JSON'), {
      target: { value: 'invalid' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(
      'Paste the signed event JSON from your signing tool.',
    );
    expect(mockedUsersApi.update).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('nostr npub'), {
      target: { value: 'npub1pppp' },
    });
    expect(
      screen.queryByLabelText('Challenge to sign'),
    ).not.toBeInTheDocument();
  });

  it('passes the bunker connection details to the signer', async () => {
    const { signNostrProof } =
      await import('../../../client/services/nostr-proof.client');
    mockedUsersApi.update.mockResolvedValue({
      ...user,
      nostrNpub: 'npub1qqqq',
    });
    renderPage();
    fireEvent.change(screen.getByLabelText('nostr npub'), {
      target: { value: 'npub1qqqq' },
    });
    fireEvent.change(screen.getByLabelText('Signing method'), {
      target: { value: 'bunker' },
    });
    fireEvent.change(screen.getByLabelText('Bunker URI'), {
      target: { value: 'bunker://fictional' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Hospitality networks updated.');
    expect(signNostrProof).toHaveBeenCalledWith(
      expect.anything(),
      'npub1qqqq',
      'bunker',
      'bunker://fictional',
      expect.any(Function),
      expect.any(AbortSignal),
    );
  });

  it.each(['household/fictional-host', 'address/fictional-host', ''])(
    'saves the Servas path %s and previews non-empty links',
    async path => {
      mockedUsersApi.update.mockResolvedValue({
        ...user,
        extSitesServas: path,
      });
      renderPage({ extSitesServas: 'household/previous-host' });
      fireEvent.change(screen.getByLabelText('servas.org/'), {
        target: { value: path },
      });
      if (path) {
        expect(screen.getByRole('link', { name: 'Test' })).toHaveAttribute(
          'href',
          `https://servas.org/${path}`,
        );
      } else {
        expect(
          screen.queryByRole('link', { name: 'Test' }),
        ).not.toBeInTheDocument();
      }
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(mockedUsersApi.update).toHaveBeenCalledWith(
          expect.objectContaining({ extSitesServas: path }),
        ),
      );
    },
  );

  beforeEach(() => {
    vi.clearAllMocks();
    delete window.nostr;
    mockedUsersApi.nostrChallenge.mockResolvedValue({
      kind: 27235,
      created_at: 1,
      tags: [],
      content: '',
    });
  });

  it('saves hospitality network changes and shows related links', async () => {
    mockedUsersApi.update.mockResolvedValue({
      ...user,
      extSitesCouchers: 'ada',
      extSitesWS: '00000000-0000-4000-8000-000000000003',
    });
    renderPage({ extSitesWS: '00000000-0000-4000-8000-000000000003' });

    expect(
      screen.getByText(
        'Copy the profile ID from your Warmshowers profile URL.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Test' })).toHaveAttribute(
      'href',
      'https://app.warmshowers.org/profiles/00000000-0000-4000-8000-000000000003',
    );

    fireEvent.change(screen.getByLabelText('couchers.org/user/'), {
      target: { value: 'ada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockedUsersApi.update).toHaveBeenCalledWith(
        expect.objectContaining({ extSitesCouchers: 'ada' }),
      );
    });
    expect(
      await screen.findByText('Hospitality networks updated.'),
    ).toBeVisible();
    expect(analytics.track).toHaveBeenCalledWith('profile_section_saved', {
      section: 'networks',
    });
  });

  it('rejects invalid npubs without saving', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('nostr npub'), {
      target: { value: 'not-an-npub' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(/Invalid nostr key\. Please provide your npub/),
    ).toBeVisible();
    expect(mockedUsersApi.update).not.toHaveBeenCalled();
  });

  it('reports save failures when linking with a browser signer', async () => {
    window.nostr = {
      getPublicKey: vi.fn().mockResolvedValue('public-key'),
      signEvent: vi.fn().mockResolvedValue({ id: 'browser-proof' }),
    };
    mockedUsersApi.update.mockRejectedValue({
      response: { status: 400, data: { message: 'Unable to save networks.' } },
    });
    renderPage();

    expect(window.nostr.getPublicKey).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Link with browser signer' }),
    );

    expect(await screen.findByText('Unable to save networks.')).toBeVisible();
    expect(analytics.track).toHaveBeenCalledWith('profile_save_failed', {
      section: 'networks',
      reason: 'validation',
    });
  });

  it('uses generic messages when network updates cannot provide one', async () => {
    mockedUsersApi.update.mockRejectedValue(new Error('offline'));
    mockedUsersApi.removeSocialAccount.mockRejectedValue(new Error('offline'));
    renderPage({
      additionalProvidersData: {
        github: { login: 'fictional-login' },
      },
    });

    fireEvent.change(screen.getByLabelText('couchers.org/user/'), {
      target: { value: 'ada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Something went wrong. Please try again!'),
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(
      await screen.findByText(
        'Something went wrong. Try again or contact us to delete this connection.',
      ),
    ).toBeVisible();
  });

  it('replaces the linked key with one click using the browser signer', async () => {
    window.nostr = {
      getPublicKey: vi.fn().mockResolvedValue('public-key'),
      signEvent: vi.fn().mockResolvedValue({ id: 'browser-proof' }),
    };
    mockedUsersApi.update.mockResolvedValue({
      ...user,
      nostrNpub: 'npub1suggestedkey',
    });
    renderPage({ nostrNpub: 'npub1existingkey' });

    fireEvent.click(
      screen.getByRole('button', { name: 'Link with browser signer' }),
    );

    await screen.findByText('Hospitality networks updated.');
    expect(mockedUsersApi.nostrChallenge).toHaveBeenCalledWith(
      'npub1suggestedkey',
    );
    expect(window.nostr.signEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 27235 }),
    );
    expect(mockedUsersApi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        nostrNpub: 'npub1suggestedkey',
        nostrProof: { id: 'browser-proof' },
      }),
    );
    expect(screen.getByLabelText('nostr npub')).toHaveValue(
      'npub1suggestedkey',
    );
  });

  it('offers a QR code and an app link for pairing when the browser signer is incomplete', async () => {
    window.nostr = { getPublicKey: vi.fn() };
    vi.mocked(signWithConnectedNostr).mockImplementationOnce(
      (_method, _challenge, onPairing, _onAuth, signal) => {
        onPairing({
          uri: 'nostrconnect://fictional',
          qr: 'data:image/png;base64,fictional',
        });
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(new Error('cancelled')),
          );
        });
      },
    );
    renderPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Connect a Nostr signer' }),
    );
    expect(signWithConnectedNostr).toHaveBeenCalledWith(
      'pair',
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(AbortSignal),
    );
    expect(
      screen.getByRole('img', { name: 'Remote signer connection QR code' }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Open signer app' }),
    ).toHaveAttribute('href', 'nostrconnect://fictional');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel pairing' }));
    await waitFor(() => {
      expect(
        screen.queryByRole('img', { name: 'Remote signer connection QR code' }),
      ).not.toBeInTheDocument();
    });
    expect(mockedUsersApi.update).not.toHaveBeenCalled();
  });

  it('renders hospitality test links except Couchsurfing', () => {
    renderPage({
      extSitesBW: 'ada-bw',
      extSitesCS: 'ada-cs',
      extSitesCouchers: 'ada-couchers',
      extSitesWS: '00000000-0000-4000-8000-000000000004',
    });

    expect(screen.getAllByRole('link', { name: 'Test' })[1]).toHaveAttribute(
      'href',
      'https://www.bewelcome.org/members/ada-bw',
    );
    expect(screen.getAllByRole('link', { name: 'Test' })).toHaveLength(3);
    const couchsurfingPreview = screen.getByText(
      'https://www.couchsurfing.com/people/ada-cs',
    );
    expect(couchsurfingPreview.closest('a')).toBeNull();
    expect(couchsurfingPreview.closest('[data-slot="input-group"]')).toBeNull();
    expect(couchsurfingPreview).toHaveClass('help-block', 'text-break');
  });

  it('lets members delete stored legacy social connections', async () => {
    mockedUsersApi.removeSocialAccount.mockResolvedValue({ ...user });
    renderPage({
      additionalProvidersData: {
        facebook: { id: 'facebook-id' },
      },
    });

    expect(screen.getByText('Legacy connections')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockedUsersApi.removeSocialAccount).toHaveBeenCalledWith(
        'facebook',
      );
    });
    expect(
      await screen.findByText('Successfully deleted the facebook connection.'),
    ).toBeVisible();
    expect(screen.queryByText('Legacy connections')).not.toBeInTheDocument();
  });

  it('reports failures when deleting a legacy social connection', async () => {
    mockedUsersApi.removeSocialAccount.mockRejectedValue({
      response: { data: { message: 'Unable to remove connection.' } },
    });
    renderPage({
      additionalProvidersData: {
        github: { login: 'fictional-login' },
      },
      extSitesWS: '00000000-0000-4000-8000-000000000004',
    });

    expect(screen.getByRole('link', { name: 'Test' })).toHaveAttribute(
      'href',
      'https://app.warmshowers.org/profiles/00000000-0000-4000-8000-000000000004',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      await screen.findByText('Unable to remove connection.'),
    ).toBeVisible();
  });

  it('uses the Warmshowers app profile URL for UUIDs', () => {
    renderPage({ extSitesWS: '00000000-0000-4000-8000-000000000001' });

    expect(screen.getByRole('link', { name: 'Test' })).toHaveAttribute(
      'href',
      'https://app.warmshowers.org/profiles/00000000-0000-4000-8000-000000000001',
    );
  });

  it('saves the Warmshowers profile UUID', async () => {
    mockedUsersApi.update.mockResolvedValue({
      ...user,
      extSitesWS: '00000000-0000-4000-8000-000000000003',
    });
    renderPage();

    fireEvent.change(screen.getByLabelText('app.warmshowers.org/profiles/'), {
      target: { value: '00000000-0000-4000-8000-000000000003' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockedUsersApi.update).toHaveBeenCalledWith(
        expect.objectContaining({
          extSitesWS: '00000000-0000-4000-8000-000000000003',
        }),
      );
    });
  });
});
