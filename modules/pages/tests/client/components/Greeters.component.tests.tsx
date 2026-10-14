import React, { act } from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import '@/config/client/i18n';
import Greeters from '@/modules/pages/client/components/Greeters.component';
import {
  getGreeters,
  type Greeter,
} from '@/modules/pages/client/api/greeters.api';

type GreeterUser = React.ComponentProps<typeof Greeters>['user'];
type GreeterRoster = Awaited<ReturnType<typeof getGreeters>>;

jest.mock('@/modules/pages/client/api/greeters.api');
const mockedGetGreeters = jest.mocked(getGreeters);

afterEach(() => jest.clearAllMocks());

const greeter: Greeter = {
  _id: 'greeter-1',
  username: 'greeter-one',
  displayName: 'Greeter One',
};
const roster: GreeterRoster = { greeters: [greeter] };
const signedInUser: GreeterUser = {
  _id: 'member-1',
  username: 'member-one',
  displayName: 'Member One',
};

describe('<Greeters />', () => {
  it('renders the current public roster and member avatars', async () => {
    mockedGetGreeters.mockResolvedValueOnce(roster);

    render(<Greeters user={signedInUser} />);

    expect(
      await screen.findByRole('link', { name: /Greeter One/ }),
    ).toHaveAttribute('href', '/profile/greeter-one');
    expect(screen.getByRole('img', { name: 'Greeter One' })).toHaveAttribute(
      'src',
      '/api/users/greeter-1/avatar?size=256',
    );
    expect(screen.getByRole('link', { name: 'Want to join?' })).toHaveAttribute(
      'href',
      '/support?category=volunteering',
    );
  });

  it('uses the fallback avatar when the visitor is signed out', async () => {
    mockedGetGreeters.mockResolvedValueOnce(roster);

    render(<Greeters user={null} />);

    expect(
      await screen.findByRole('img', { name: 'Greeter One' }),
    ).toHaveAttribute('src', '/img/avatar.png');
  });

  it('falls back to the username when a greeter has no display name', async () => {
    mockedGetGreeters.mockResolvedValueOnce({
      greeters: [{ ...greeter, displayName: '' }],
    });

    render(<Greeters user={null} />);

    expect(
      await screen.findByRole('img', { name: 'greeter-one' }),
    ).toHaveAttribute('src', '/img/avatar.png');
    expect(
      screen.getByRole('heading', { name: 'greeter-one' }),
    ).toBeInTheDocument();
  });

  it('shows a loading state, then an empty state', async () => {
    let resolveRoster!: (value: GreeterRoster) => void;
    mockedGetGreeters.mockReturnValueOnce(
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
    mockedGetGreeters.mockRejectedValueOnce(new Error('request failed'));

    render(<Greeters user={null} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Greeters could not be loaded. Please try again later.',
    );
  });

  it('does not update state when a pending roster resolves after unmount', async () => {
    let resolveRoster!: (value: GreeterRoster) => void;
    mockedGetGreeters.mockReturnValueOnce(
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
    let rejectRoster!: (reason: unknown) => void;
    mockedGetGreeters.mockReturnValueOnce(
      new Promise<GreeterRoster>((resolve, reject) => {
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
