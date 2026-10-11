import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { AppProviders } from '@/modules/core/client/react-app/AppProviders';
import ProfileEditNetworks from '@/modules/users/client/components/ProfileEditNetworks.component';
import * as usersApi from '@/modules/users/client/api/users.api';
import type { UserProfile } from '@/modules/users/client/types';

const mockedUsersApi = jest.mocked(usersApi);

jest.mock('@/modules/users/client/api/users.api');
jest.mock('nostr-tools', () => ({
  nip19: { npubEncode: jest.fn(() => 'npub1suggestedkey') },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { provider?: string }) =>
      values?.provider ? key.replace('{{provider}}', values.provider) : key,
  }),
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

const user: UserProfile = {
  _id: 'user-1',
  username: 'ada',
  displayName: 'Ada Example',
};

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

describe('ProfileEditNetworks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete window.nostr;
  });

  it('saves hospitality network changes and shows related links', async () => {
    mockedUsersApi.update.mockResolvedValue({
      ...user,
      extSitesCouchers: 'ada',
      extSitesWS: 'rainy-cyclist',
    });
    renderPage({ extSitesWS: 'rainy-cyclist' });

    expect(
      screen.getByText('This should be your numeric user id, not username.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Test' })).toHaveAttribute(
      'href',
      'https://www.warmshowers.org/users/rainy-cyclist',
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

  it('uses a browser Nostr key suggestion and reports save failures', async () => {
    window.nostr = {
      getPublicKey: jest.fn().mockResolvedValue('public-key'),
    };
    mockedUsersApi.update.mockRejectedValue({
      response: { data: { message: 'Unable to save networks.' } },
    });
    renderPage();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Use this npub' }),
    );
    expect(screen.getByLabelText('nostr npub')).toHaveValue(
      'npub1suggestedkey',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Unable to save networks.')).toBeVisible();
  });

  it('uses generic messages when network updates cannot provide one', async () => {
    mockedUsersApi.update.mockRejectedValue(new Error('offline'));
    mockedUsersApi.removeSocialAccount.mockRejectedValue(new Error('offline'));
    renderPage({
      additionalProvidersData: {
        github: { id: 'github-id' },
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

  it('replaces an existing Nostr key with a browser suggestion', async () => {
    window.nostr = {
      getPublicKey: jest.fn().mockResolvedValue('public-key'),
    };
    renderPage({ nostrNpub: 'npub1existingkey' });

    fireEvent.click(
      await screen.findByRole('button', { name: 'Replace with this npub' }),
    );

    expect(screen.getByLabelText('nostr npub')).toHaveValue(
      'npub1suggestedkey',
    );
  });

  it('ignores unavailable browser Nostr keys', async () => {
    window.nostr = {
      getPublicKey: jest.fn().mockRejectedValue(new Error('offline')),
    };

    renderPage();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(
      screen.queryByRole('button', { name: 'Use this npub' }),
    ).not.toBeInTheDocument();
  });

  it('renders links for all supported hospitality networks', () => {
    renderPage({
      extSitesBW: 'ada-bw',
      extSitesCS: 'ada-cs',
      extSitesCouchers: 'ada-couchers',
      extSitesWS: '123',
    });

    expect(screen.getAllByRole('link', { name: 'Test' })[1]).toHaveAttribute(
      'href',
      'https://www.bewelcome.org/members/ada-bw',
    );
    expect(screen.getAllByRole('link', { name: 'Test' })).toHaveLength(4);
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
        github: { id: 'github-id' },
      },
      extSitesWS: '123',
    });

    expect(screen.getByRole('link', { name: 'Test' })).toHaveAttribute(
      'href',
      'https://www.warmshowers.org/user/123',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      await screen.findByText('Unable to remove connection.'),
    ).toBeVisible();
  });

  it('uses the legacy warmshowers user URL for numeric ids', () => {
    renderPage({ extSitesWS: '12345' });

    expect(screen.getByRole('link', { name: 'Test' })).toHaveAttribute(
      'href',
      'https://www.warmshowers.org/user/12345',
    );
  });

  it('uses the profile URL for non-numeric warmshowers ids', async () => {
    mockedUsersApi.update.mockResolvedValue({
      ...user,
      extSitesWS: 'rainy-cyclist',
    });
    renderPage();

    fireEvent.change(screen.getByLabelText('warmshowers.org/user/'), {
      target: { value: 'rainy-cyclist' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockedUsersApi.update).toHaveBeenCalledWith(
        expect.objectContaining({ extSitesWS: 'rainy-cyclist' }),
      );
    });
  });
});
