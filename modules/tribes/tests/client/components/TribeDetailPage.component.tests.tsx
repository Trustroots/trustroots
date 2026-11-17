import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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

const getMock = vi.mocked(get);
const user: UserProfile = {
  _id: 'user-1',
  username: 'circle-member',
  displayName: 'Circle Member',
};

vi.mock('@/modules/tribes/client/api/tribes.api');
vi.mock('@/modules/tribes/client/components/RadioCircle', () => ({
  __esModule: true,
  default: ({ user }: { user?: UserProfile }) => (
    <section aria-label="Radio player">{user?.username || 'visitor'}</section>
  ),
}));

it.each([undefined, user])(
  'renders radio only on the Radio circle for viewer %o',
  async viewer => {
    getMock.mockResolvedValue({
      _id: 'fictional-radio',
      slug: 'radio',
      label: 'Radio',
      count: 0,
    });
    render(
      <TribeDetailPage
        circle="radio"
        user={viewer}
        onMembershipUpdated={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole('region', { name: 'Radio player' }),
    ).toHaveTextContent(viewer?.username || 'visitor');
  },
);
vi.mock('@/modules/tribes/client/components/HitchhikingMap', () => ({
  default: function MockHitchhikingMap() {
    return <div>Recent Hitchwiki locations</div>;
  },
}));
vi.mock('@/modules/tribes/client/components/HackerspaceMap', () => ({
  default: function MockHackerspaceMap() {
    return <div data-testid="hackerspace-map">Reported hackerspaces</div>;
  },
}));

vi.mock('@/modules/core/client/components/LoadingIndicator', () => ({
  __esModule: true,
  default: () => <div data-testid="loading-indicator" />,
}));

vi.mock('@/modules/tribes/client/components/JoinButton', () => ({
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

vi.mock('@/modules/tribes/client/components/CircleMemberDiscovery', () => ({
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
    vi.clearAllMocks();
    getMock.mockResolvedValue(tribe);
  });

  it('shows organisers above the description and keeps them after joining', async () => {
    getMock.mockResolvedValue({
      ...tribe,
      organisers: [
        { username: 'example-organiser', displayName: 'Example Organiser' },
        { username: 'another-organiser' },
      ],
    });
    render(
      <TribeDetailPage
        circle="hitchhikers"
        user={user}
        onMembershipUpdated={vi.fn()}
      />,
    );
    const link = await screen.findByRole('link', {
      name: 'Example Organiser @example-organiser',
    });
    expect(link).toHaveAttribute('href', '/profile/example-organiser');
    expect(link).toHaveClass('member-search-card');
    const description = screen.getByText('Guide the galaxy.');
    expect(link.compareDocumentPosition(description)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(
      screen.getByRole('link', { name: '@another-organiser' }),
    ).toHaveAttribute('href', '/profile/another-organiser');
    fireEvent.click(
      screen.getByRole('button', { name: 'Join as circle member' }),
    );
    expect(
      screen.getByRole('link', {
        name: 'Example Organiser @example-organiser',
      }),
    ).toBeVisible();
  });

  it.each([[undefined], [['user']], [['support-team']], [['admin']]])(
    'shows the editor only to circle administrators (%j)',
    async roles => {
      render(
        <TribeDetailPage
          circle="hitchhikers"
          user={
            roles
              ? {
                  _id: 'member',
                  username: 'example-member',
                  displayName: 'Example Member',
                  roles,
                }
              : undefined
          }
          onMembershipUpdated={vi.fn()}
        />,
      );
      await screen.findByText('Hitchhikers');
      const link = screen.queryByRole('link', { name: 'Edit circle' });
      if (roles?.includes('admin')) {
        expect(link).toHaveAttribute('href', '/admin/circles/hitchhikers');
      } else {
        expect(link).not.toBeInTheDocument();
      }
    },
  );

  it('preserves safe links in the circle description', async () => {
    getMock.mockResolvedValue({
      ...tribe,
      description:
        '<p>Read the <a href="https://example.org/">circle guide</a> <a href="javascript:alert(1)">unsafe link</a>.</p>',
    });
    render(
      <TribeDetailPage circle="hitchhikers" onMembershipUpdated={vi.fn()} />,
    );
    const link = await screen.findByRole('link', { name: 'circle guide' });
    expect(link).toHaveAttribute('href', 'https://example.org/');
    expect(
      screen.queryByRole('link', { name: 'unsafe link' }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['hitchhikers', 'Recent Hitchwiki locations'],
    ['hackers', 'Reported hackerspaces'],
    ['fictional', null],
  ])('selects the appropriate prominent map for %s', async (slug, mapText) => {
    getMock.mockResolvedValue({ ...tribe, slug });
    const { container } = render(
      <TribeDetailPage circle={slug!} onMembershipUpdated={vi.fn()} />,
    );
    await screen.findByRole('heading', { name: 'Hitchhikers' });
    if (mapText) {
      expect(screen.getByText(mapText)).toBeInTheDocument();
      expect(
        container.querySelector('.has-location-map .circle-hero-map'),
      ).toBeInTheDocument();
    } else expect(container.querySelector('.circle-hero-map')).toBeNull();
  });

  it.each([undefined, user, { ...user, memberIds: ['tribe-1'] }])(
    'renders the Hackers map and attributed resources for viewer %o',
    async viewer => {
      getMock.mockResolvedValue({
        ...tribe,
        slug: 'hackers',
        label: 'Hackers',
      });
      render(
        <TribeDetailPage
          circle="hackers"
          user={viewer}
          onMembershipUpdated={vi.fn()}
        />,
      );
      await screen.findByRole('heading', { name: 'Hackers' });
      expect(screen.getByTestId('hackerspace-map')).toBeVisible();
      expect(screen.getByRole('link', { name: 'Circle Wiki' })).toHaveAttribute(
        'href',
        'https://wiki.trustroots.org/en/Hackers',
      );
      expect(
        screen.getByRole('link', { name: 'Trustroots Wiki' }),
      ).toHaveAttribute(
        'href',
        'https://wiki.trustroots.org/index.php?title=Hackers&oldid=26505',
      );
      expect(
        screen.getByRole('link', { name: 'CC BY-SA 4.0' }),
      ).toHaveAttribute(
        'href',
        'https://creativecommons.org/licenses/by-sa/4.0/',
      );
    },
  );

  it('shows a loading indicator while the circle is fetched', () => {
    getMock.mockReturnValue(new Promise(() => {}));

    render(
      <TribeDetailPage
        circle="hitchhikers"
        onMembershipUpdated={vi.fn()}
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
        onMembershipUpdated={vi.fn()}
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
        onMembershipUpdated={vi.fn()}
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
        onMembershipUpdated={vi.fn()}
        user={user}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Hitchhikers' }),
    ).toBeInTheDocument();
    expect(getTribeHeaderBackgroundStyle(tribe)).toEqual({});
    const styledBackground = getTribeHeaderBackgroundStyle({
      ...tribe,
      slug: 'hitchhikers',
      image: 'circle-photo',
      color: '123456',
    });
    expect(styledBackground.backgroundImage).toContain(
      '/uploads-circle/hitchhikers/1400x900.',
    );
    expect(styledBackground.backgroundColor).toBe('#123456');
  });

  it('prompts guests to sign up for the circle', async () => {
    render(
      <TribeDetailPage
        circle="hitchhikers"
        onMembershipUpdated={vi.fn()}
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
    const onMembershipUpdated = vi.fn<(...args: [MembershipUpdate]) => void>();

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
        onMembershipUpdated={vi.fn()}
        user={{ ...user, _id: 'member-1', memberIds: ['tribe-1'] }}
      />,
    );
    expect(
      await screen.findByTestId('circle-member-discovery'),
    ).toHaveTextContent('hitchhikers:member-1');

    rerender(
      <TribeDetailPage
        circle="hitchhikers"
        onMembershipUpdated={vi.fn()}
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
        onMembershipUpdated={vi.fn()}
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
        onMembershipUpdated={vi.fn()}
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
      <TribeDetailPage circle="hitchhikers" onMembershipUpdated={vi.fn()} />,
    );
    expect(await screen.findByText('One member')).toBeInTheDocument();
  });

  it('shows attribution without a link and ignores empty updates', async () => {
    getMock.mockResolvedValue({
      ...tribe,
      attribution_url: undefined,
    });
    const onMembershipUpdated = vi.fn<(...args: [MembershipUpdate]) => void>();

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
        onMembershipUpdated={vi.fn()}
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
        onMembershipUpdated={vi.fn()}
        user={user}
      />,
    );
    secondRender.unmount();
    rejectCircle(new Error('late failure'));
    await new Promise(resolve => setTimeout(resolve, 0));
  });
});
