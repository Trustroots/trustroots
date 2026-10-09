import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import TribeDetailPage, {
  getTribeHeaderBackgroundStyle,
} from '@/modules/tribes/client/components/TribeDetailPage.component';
import {
  get,
  type MembershipUpdate,
  type TribeSummary,
} from '@/modules/tribes/client/api/tribes.api';
import type JoinButton from '@/modules/tribes/client/components/JoinButton';
import type CircleMemberDiscovery from '@/modules/tribes/client/components/CircleMemberDiscovery';
import type { UserProfile } from '@/modules/users/client/types';

const getMock = jest.mocked(get);
const user: UserProfile = {
  _id: 'user-1',
  username: 'circle-member',
  displayName: 'Circle Member',
};

jest.mock('@/modules/tribes/client/api/tribes.api');

jest.mock('@/modules/core/client/components/LoadingIndicator', () => ({
  __esModule: true,
  default: () => <div data-testid="loading-indicator" />,
}));

jest.mock('@/modules/tribes/client/components/JoinButton', () => ({
  __esModule: true,
  default: ({ onUpdated, user }: React.ComponentProps<typeof JoinButton>) => (
    <>
      <button
        onClick={() =>
          onUpdated?.({
            tribe: {
              _id: 'tribe-1',
              slug: 'hitchhikers',
              label: 'Hitchhikers',
              count: 42,
            },
          })
        }
        type="button"
      >
        Join circle
      </button>
      <button onClick={() => onUpdated?.({})} type="button">
        Ignore circle update
      </button>
      <button
        onClick={() =>
          onUpdated?.({
            tribe: {
              _id: 'tribe-1',
              slug: 'hitchhikers',
              label: 'Hitchhikers',
              count: 42,
            },
            user: { ...user!, memberIds: ['tribe-1'] },
          })
        }
        type="button"
      >
        Join as circle member
      </button>
    </>
  ),
}));

jest.mock('@/modules/tribes/client/components/CircleMemberDiscovery', () => ({
  __esModule: true,
  default: ({
    circle,
    user,
  }: React.ComponentProps<typeof CircleMemberDiscovery>) => (
    <div data-testid="circle-member-discovery">
      {circle.slug}:{user._id}
    </div>
  ),
}));

describe('<TribeDetailPage circle="hitchhikers" />', () => {
  const tribe: TribeSummary = {
    _id: 'tribe-1',
    slug: 'hitchhikers',
    label: 'Hitchhikers',
    count: 12,
    description: '<p>Guide the galaxy.</p>',
    attribution: 'Photo Artist',
    attribution_url: 'https://example.com/artist',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getMock.mockResolvedValue(tribe);
  });

  it('shows a loading indicator while the circle is fetched', () => {
    getMock.mockReturnValue(new Promise(() => {}));

    render(
      <TribeDetailPage
        circle="hitchhikers"
        onMembershipUpdated={jest.fn()}
        user={user}
      />,
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.getByText(/wait a moment/i)).toBeInTheDocument();
  });

  it('shows a not-found message when the circle cannot be loaded', async () => {
    getMock.mockRejectedValue(new Error('missing'));

    render(
      <TribeDetailPage
        circle="hitchhikers"
        onMembershipUpdated={jest.fn()}
        user={user}
      />,
    );

    expect(
      await screen.findByRole('heading', {
        name: /this circle is not here/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /see other circles/i }),
    ).toHaveAttribute('href', '/circles');
  });

  it('renders circle details for signed-in members', async () => {
    render(
      <TribeDetailPage
        circle="hitchhikers"
        onMembershipUpdated={jest.fn()}
        user={user}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Hitchhikers' }),
    ).toBeInTheDocument();
    expect(screen.getByText('12 members')).toBeInTheDocument();
    expect(screen.getByText('Guide the galaxy.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /find members/i })).toHaveAttribute(
      'href',
      '/search?tribe=hitchhikers',
    );
    expect(screen.getByRole('link', { name: /circle wiki/i })).toHaveAttribute(
      'href',
      'https://wiki.trustroots.org/en/Hitchhikers',
    );
    expect(screen.getByRole('link', { name: 'Photo Artist' })).toHaveAttribute(
      'href',
      'https://example.com/artist',
    );
  });

  it('renders the header when the circle has no background image or colour', async () => {
    getMock.mockResolvedValue({
      _id: 'tribe-1',
      slug: 'hitchhikers',
      label: 'Hitchhikers',
      count: 12,
    });

    render(
      <TribeDetailPage
        circle="hitchhikers"
        onMembershipUpdated={jest.fn()}
        user={user}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Hitchhikers' }),
    ).toBeInTheDocument();
    expect(JSON.stringify(getTribeHeaderBackgroundStyle(tribe))).not.toMatch(
      /background-image|background-color/,
    );
    const styledBackground = JSON.stringify(
      getTribeHeaderBackgroundStyle({
        ...tribe,
        slug: 'hitchhikers',
        image: 'circle-photo',
        color: '123456',
      }),
    );
    expect(styledBackground).toContain('background-image');
    expect(styledBackground).toContain('background-color');
  });

  it('prompts guests to sign up for the circle', async () => {
    render(
      <TribeDetailPage
        circle="hitchhikers"
        onMembershipUpdated={jest.fn()}
        user={undefined}
      />,
    );

    expect(
      await screen.findByRole('link', {
        name: /join hitchhikers on trustroots/i,
      }),
    ).toHaveAttribute('href', '/signup?tribe=hitchhikers');
    expect(document.querySelector('.is-guest')).toBeTruthy();
  });

  it('forwards membership updates to the parent callback', async () => {
    const onMembershipUpdated = jest.fn<void, [MembershipUpdate]>();

    render(
      <TribeDetailPage
        circle="hitchhikers"
        onMembershipUpdated={onMembershipUpdated}
        user={user}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: /join circle/i }),
    );

    expect(onMembershipUpdated).toHaveBeenCalledWith({
      tribe: expect.objectContaining({ _id: 'tribe-1', count: 42 }),
    });
    expect(await screen.findByText('42 members')).toBeInTheDocument();
  });

  it('shows member discovery for current and newly joined members', async () => {
    const { rerender } = render(
      <TribeDetailPage
        circle="hitchhikers"
        onMembershipUpdated={jest.fn()}
        user={{ ...user, _id: 'member-1', memberIds: ['tribe-1'] }}
      />,
    );
    expect(
      await screen.findByTestId('circle-member-discovery'),
    ).toHaveTextContent('hitchhikers:member-1');

    rerender(
      <TribeDetailPage
        circle="hitchhikers"
        onMembershipUpdated={jest.fn()}
        user={{ ...user, _id: 'member-2' }}
      />,
    );
    await screen.findByRole('heading', { name: 'Hitchhikers' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Join as circle member' }),
    );
    expect(
      await screen.findByTestId('circle-member-discovery'),
    ).toHaveTextContent('hitchhikers:member-2');
  });

  it('shows the empty-member copy when a circle has no members', async () => {
    getMock.mockResolvedValue({ ...tribe, count: 0 });

    render(
      <TribeDetailPage
        circle="hitchhikers"
        onMembershipUpdated={jest.fn()}
        user={user}
      />,
    );

    expect(await screen.findByText('No members yet')).toBeInTheDocument();
  });

  it('omits the wiki link when the circle has no slug', async () => {
    getMock.mockResolvedValue({ ...tribe, slug: '' });

    render(
      <TribeDetailPage
        circle="hitchhikers"
        onMembershipUpdated={jest.fn()}
        user={user}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Hitchhikers' }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('link', { name: /circle wiki/i }),
    ).not.toBeInTheDocument();
  });

  it('uses the singular member label', async () => {
    getMock.mockResolvedValue({ ...tribe, count: 1 });
    render(
      <TribeDetailPage circle="hitchhikers" onMembershipUpdated={jest.fn()} />,
    );
    expect(await screen.findByText('One member')).toBeInTheDocument();
  });

  it('shows attribution without a link and ignores empty updates', async () => {
    getMock.mockResolvedValue({
      ...tribe,
      attribution_url: undefined,
    });
    const onMembershipUpdated = jest.fn<void, [MembershipUpdate]>();

    render(
      <TribeDetailPage
        circle="hitchhikers"
        onMembershipUpdated={onMembershipUpdated}
        user={user}
      />,
    );

    expect(
      await screen.findByText(
        (_content, element) => element?.textContent === 'Photo by Photo Artist',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Photo Artist' }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Ignore circle update' }),
    );
    expect(onMembershipUpdated).toHaveBeenCalledWith({});
  });

  it('ignores circle results and failures after unmounting', async () => {
    let resolveCircle!: (circle: TribeSummary) => void;
    getMock.mockReturnValue(
      new Promise(resolve => {
        resolveCircle = resolve;
      }),
    );
    const firstRender = render(
      <TribeDetailPage
        circle="hitchhikers"
        onMembershipUpdated={jest.fn()}
        user={user}
      />,
    );
    firstRender.unmount();
    resolveCircle(tribe);
    await new Promise(resolve => setTimeout(resolve, 0));

    let rejectCircle!: (error: Error) => void;
    getMock.mockReturnValue(
      new Promise((resolve, reject) => {
        rejectCircle = reject;
      }),
    );
    const secondRender = render(
      <TribeDetailPage
        circle="hitchhikers"
        onMembershipUpdated={jest.fn()}
        user={user}
      />,
    );
    secondRender.unmount();
    rejectCircle(new Error('late failure'));
    await new Promise(resolve => setTimeout(resolve, 0));
  });
});
