import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { AppProviders } from '@/layers/shell/client/AppProviders';
import ProfileEditNetworks from '@/modules/users/client/components/ProfileEditNetworks.component';
import * as usersApi from '@/modules/users/client/api/users.api';
import {
  signWithConnectedNostr,
  withConnectedNostr,
} from '@/modules/users/client/services/nostr-proof.client';
import { publishNostrProfile } from '@/modules/users/client/services/nostr-profile.client';
import type { UserProfile } from '@/modules/users/client/types';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';

const analytics = fakeAnalytics();

vi.mock('@/modules/users/client/services/nostr-proof.client', async () => ({
  ...(await vi.importActual<
    typeof import('@/modules/users/client/services/nostr-proof.client')
  >('@/modules/users/client/services/nostr-proof.client')),
  signNostrProof: vi.fn<
    typeof import('@/modules/users/client/services/nostr-proof.client').signNostrProof
  >(async (_event, npub, _method, _uri, _onAuth, _signal, complete) => {
    const proof = { id: 'signed-proof' };
    await complete?.({ npub, proof }, vi.fn());
    return proof;
  }),
  signWithConnectedNostr: vi.fn(
    (
      await vi.importActual<
        typeof import('@/modules/users/client/services/nostr-proof.client')
      >('@/modules/users/client/services/nostr-proof.client')
    ).signWithConnectedNostr,
  ),
  withConnectedNostr: vi.fn(
    (
      await vi.importActual<
        typeof import('@/modules/users/client/services/nostr-proof.client')
      >('@/modules/users/client/services/nostr-proof.client')
    ).withConnectedNostr,
  ),
}));
vi.mock('@/modules/users/client/services/nostr-profile.client', () => ({
  publishNostrProfile: vi.fn().mockResolvedValue('published'),
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
  it.each(['fictional hiker', ''])(
    'saves the Hitchwiki Maps username %j',
    async username => {
      mockedUsersApi.update.mockResolvedValue({
        ...user,
        extSitesHitchwikiMaps: username,
      });
      renderPage({ extSitesHitchwikiMaps: 'previous-hiker' });
      fireEvent.change(screen.getByLabelText('maps.hitchwiki.org/account/'), {
        target: { value: username },
      });
      if (username) {
        expect(screen.getByRole('link', { name: 'Test' })).toHaveAttribute(
          'href',
          'https://maps.hitchwiki.org/account/fictional%20hiker',
        );
      } else {
        expect(
          screen.queryByRole('link', { name: 'Test' }),
        ).not.toBeInTheDocument();
      }
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(mockedUsersApi.update).toHaveBeenCalledWith(
          expect.objectContaining({ extSitesHitchwikiMaps: username }),
        ),
      );
    },
  );

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
    expect(publishNostrProfile).not.toHaveBeenCalled();
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
      expect.any(Function),
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
      expect.any(Function),
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

  it('keeps a saved key when publication fails and retries without saving again', async () => {
    window.nostr = {
      getPublicKey: vi.fn().mockResolvedValue('f'.repeat(64)),
      signEvent: vi.fn().mockResolvedValue({ id: 'browser-proof' }),
    };
    mockedUsersApi.update.mockResolvedValue({
      ...user,
      nostrNpub: 'npub1suggestedkey',
    });
    vi.mocked(publishNostrProfile).mockRejectedValueOnce(new Error('offline'));
    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Link with browser signer' }),
    );
    await screen.findByText('Hospitality networks updated.');
    await screen.findByText(
      'Could not publish your Nostr address. You can try again.',
    );
    expect(screen.getByLabelText('nostr npub')).toHaveValue(
      'npub1suggestedkey',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Publish Nostr address' }),
    );
    await screen.findByText('Your Trustroots Nostr address is published.');
    expect(publishNostrProfile).toHaveBeenCalledTimes(2);
    expect(mockedUsersApi.update).toHaveBeenCalledTimes(1);
  });

  it('explains when the saved key is absent from the public lookup', async () => {
    window.nostr = {
      getPublicKey: vi.fn().mockResolvedValue('f'.repeat(64)),
      signEvent: vi.fn(),
    };
    vi.mocked(publishNostrProfile).mockResolvedValueOnce('unavailable');
    renderPage({ nostrNpub: 'npub1suggestedkey' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Publish Nostr address' }),
    );
    await screen.findByText(
      'Your Trustroots Nostr address is unavailable in the public lookup.',
    );
    expect(mockedUsersApi.update).not.toHaveBeenCalled();
  });

  it('uses a paired signer for a saved key and refuses a different key', async () => {
    vi.mocked(withConnectedNostr).mockImplementationOnce(
      (_method, _onPairing, _onAuth, _signal, work) =>
        work('npub1different', vi.fn()),
    );
    renderPage({ nostrNpub: 'npub1suggestedkey' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Publish Nostr address' }),
    );
    await screen.findByText('The signer public key does not match this npub.');
    expect(withConnectedNostr).toHaveBeenCalledWith(
      'pair',
      expect.any(Function),
      expect.any(Function),
      expect.any(AbortSignal),
      expect.any(Function),
    );
    expect(publishNostrProfile).not.toHaveBeenCalled();
  });

  it('ignores a duplicate form submission while the save is in progress', async () => {
    let resolveSave: (
      profile: Awaited<ReturnType<typeof usersApi.update>>,
    ) => void;
    mockedUsersApi.update.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveSave = resolve;
        }),
    );
    renderPage();
    fireEvent.change(screen.getByLabelText('couchers.org/user/'), {
      target: { value: 'fictional-member' },
    });
    const save = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    fireEvent.submit(save.closest('form')!);
    expect(mockedUsersApi.update).toHaveBeenCalledTimes(1);
    resolveSave!({ ...user, extSitesCouchers: 'fictional-member' });
    await screen.findByText('Hospitality networks updated.');
  });

  it('opens other hospitality test links in new tabs and warns before Couchsurfing', async () => {
    renderPage({
      extSitesBW: 'ada-bw',
      extSitesCS: 'ada-cs',
      extSitesCouchers: 'ada-couchers',
      extSitesWS: '00000000-0000-4000-8000-000000000004',
    });

    const testLinks = screen.getAllByRole('link', { name: 'Test' });
    expect(testLinks[1]).toHaveAttribute(
      'href',
      'https://www.bewelcome.org/members/ada-bw',
    );
    expect(testLinks).toHaveLength(3);
    for (const link of testLinks) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }

    const testButton = screen.getByRole('button', { name: 'Test' });
    expect(testButton).toHaveAttribute('type', 'button');
    fireEvent.click(testButton);
    const dialog = screen.getByRole('dialog', {
      name: 'Continue to Couchsurfing?',
    });
    expect(within(dialog).getByRole('alert')).toBeVisible();
    expect(
      within(dialog).getByRole('link', {
        name: 'Open Couchsurfing in a new tab',
      }),
    ).toHaveAttribute('href', 'https://www.couchsurfing.com/people/ada-cs');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it('shows a plain Couchsurfing preview until the member has saved a username', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('couchsurfing.com/people/'), {
      target: { value: 'ada-cs' },
    });
    const couchsurfingPreview = screen.getByText(
      'https://www.couchsurfing.com/people/ada-cs',
    );
    expect(couchsurfingPreview.closest('a')).toBeNull();
    expect(couchsurfingPreview.closest('[data-slot="input-group"]')).toBeNull();
    expect(couchsurfingPreview).toHaveClass('help-block', 'text-break');
    expect(
      screen.queryByRole('button', { name: 'Test' }),
    ).not.toBeInTheDocument();
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
