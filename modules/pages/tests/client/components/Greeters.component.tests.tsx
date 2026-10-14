import React, { act } from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import '@/config/client/i18n';
import Greeters from '@/modules/pages/client/components/Greeters.component';
import {
  getGreeters,
  type Greeter,
} from '@/modules/pages/client/api/greeters.api';

jest.mock('@/modules/pages/client/api/greeters.api');

const getGreetersMock = jest.mocked(getGreeters);
type GreeterRoster = { greeters: Greeter[] };

afterEach(() => jest.clearAllMocks());

describe('<Greeters />', () => {
  it('renders the current public roster and member avatars', async () => {
    getGreetersMock.mockResolvedValueOnce({
      greeters: [{ _id: 'g1', username: 'river', displayName: 'River Host' }],
    });

    render(
      <Greeters
        user={{ _id: 'me', username: 'member', displayName: 'Member' }}
      />,
    );

    expect(
      await screen.findByRole('link', { name: /River Host/ }),
    ).toHaveAttribute('href', '/profile/river');
    expect(screen.getByRole('img', { name: 'River Host' })).toHaveAttribute(
      'src',
      '/api/users/g1/avatar?size=256',
    );
    expect(screen.getByRole('link', { name: 'Want to join?' })).toHaveAttribute(
      'href',
      '/support?category=volunteering',
    );
  });

  it('uses the fallback avatar when the visitor is signed out', async () => {
    getGreetersMock.mockResolvedValueOnce({
      greeters: [{ _id: 'g1', username: 'river', displayName: 'River Host' }],
    });

    render(<Greeters user={null} />);

    expect(
      await screen.findByRole('img', { name: 'River Host' }),
    ).toHaveAttribute('src', '/img/avatar.png');
  });

  it('falls back to the username when a greeter has no display name', async () => {
    getGreetersMock.mockResolvedValueOnce({
      greeters: [{ _id: 'g1', username: 'river', displayName: '' }],
    });

    render(<Greeters user={null} />);

    expect(await screen.findByRole('img', { name: 'river' })).toHaveAttribute(
      'src',
      '/img/avatar.png',
    );
    expect(screen.getByRole('heading', { name: 'river' })).toBeInTheDocument();
  });

  it('shows a loading state, then an empty state', async () => {
    let resolveRoster!: (roster: GreeterRoster) => void;
    getGreetersMock.mockReturnValueOnce(
      new Promise<GreeterRoster>(resolve => {
        resolveRoster = resolve;
      }),
    );

    render(<Greeters user={null} />);

    expect(await screen.findByText('Wait a moment…')).toBeInTheDocument();
    resolveRoster({ greeters: [] });
    expect(
      await screen.findByText('No greeters to show right now.'),
    ).toBeInTheDocument();
  });

  it('shows an error state when the roster cannot be loaded', async () => {
    getGreetersMock.mockRejectedValueOnce(new Error('request failed'));

    render(<Greeters user={null} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Greeters could not be loaded. Please try again later.',
    );
  });

  it('does not update state when a pending roster resolves after unmount', async () => {
    let resolveRoster!: (roster: GreeterRoster) => void;
    getGreetersMock.mockReturnValueOnce(
      new Promise<GreeterRoster>(resolve => {
        resolveRoster = resolve;
      }),
    );

    const { unmount } = render(<Greeters user={null} />);
    unmount();

    await act(async () => {
      resolveRoster({ greeters: [] });
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  it('does not update state when a pending roster rejects after unmount', async () => {
    let rejectRoster!: (error: Error) => void;
    getGreetersMock.mockReturnValueOnce(
      new Promise<GreeterRoster>((_resolve, reject) => {
        rejectRoster = reject;
      }),
    );

    const { unmount } = render(<Greeters user={null} />);
    unmount();

    await act(async () => {
      rejectRoster(new Error('request failed'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  });
});
