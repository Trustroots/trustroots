import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import TribeDetailPage from '@/modules/tribes/client/components/TribeDetailPage.component';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';

jest.mock('@/modules/tribes/client/api/tribes.api');

jest.mock('@/modules/core/client/services/client-runtime', () => ({
  getCurrentRouteParams: () => ({ circle: 'hitchhikers' }),
}));

jest.mock('@/modules/core/client/components/LoadingIndicator', () => ({
  __esModule: true,
  default: () => <div data-testid="loading-indicator" />,
}));

jest.mock('@/modules/tribes/client/components/JoinButton', () => ({
  __esModule: true,
  default: ({ onUpdated }) => (
    <>
      <button
        onClick={() =>
          onUpdated({
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
      <button onClick={() => onUpdated({})} type="button">
        Ignore circle update
      </button>
    </>
  ),
}));

describe('<TribeDetailPage />', () => {
  const tribe = {
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
    tribesApi.get.mockResolvedValue(tribe);
  });

  it('shows a loading indicator while the circle is fetched', () => {
    tribesApi.get.mockReturnValue(new Promise(() => {}));

    render(
      <TribeDetailPage onMembershipUpdated={jest.fn()} user={{ _id: 'u1' }} />,
    );

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.getByText(/wait a moment/i)).toBeInTheDocument();
  });

  it('shows a not-found message when the circle cannot be loaded', async () => {
    tribesApi.get.mockRejectedValue(new Error('missing'));

    render(
      <TribeDetailPage onMembershipUpdated={jest.fn()} user={{ _id: 'u1' }} />,
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
        onMembershipUpdated={jest.fn()}
        user={{ _id: 'user-1', username: 'alice' }}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Hitchhikers' }),
    ).toBeInTheDocument();
    expect(screen.getByText('12 members')).toBeInTheDocument();
    expect(screen.getByText('Guide the galaxy.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /find members/i })).toHaveAttribute(
      'href',
      '/search/map?tribe=hitchhikers',
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

  it('prompts guests to sign up for the circle', async () => {
    render(<TribeDetailPage onMembershipUpdated={jest.fn()} user={null} />);

    expect(
      await screen.findByRole('link', {
        name: /join hitchhikers on trustroots/i,
      }),
    ).toHaveAttribute('href', '/signup?tribe=hitchhikers');
    expect(document.querySelector('.is-guest')).toBeTruthy();
  });

  it('forwards membership updates to the parent callback', async () => {
    const onMembershipUpdated = jest.fn();

    render(
      <TribeDetailPage
        onMembershipUpdated={onMembershipUpdated}
        user={{ _id: 'user-1' }}
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

  it('shows the empty-member copy when a circle has no members', async () => {
    tribesApi.get.mockResolvedValue({ ...tribe, count: 0 });

    render(
      <TribeDetailPage onMembershipUpdated={jest.fn()} user={{ _id: 'u1' }} />,
    );

    expect(await screen.findByText('No members yet')).toBeInTheDocument();
  });

  it('omits the wiki link when the circle has no slug', async () => {
    tribesApi.get.mockResolvedValue({ ...tribe, slug: '' });

    render(
      <TribeDetailPage onMembershipUpdated={jest.fn()} user={{ _id: 'u1' }} />,
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

  it('shows attribution without a link and ignores empty updates', async () => {
    tribesApi.get.mockResolvedValue({
      ...tribe,
      attribution_url: undefined,
    });
    const onMembershipUpdated = jest.fn();

    render(
      <TribeDetailPage
        onMembershipUpdated={onMembershipUpdated}
        user={{ _id: 'user-1' }}
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
    let resolveCircle;
    tribesApi.get.mockReturnValue(
      new Promise(resolve => {
        resolveCircle = resolve;
      }),
    );
    const firstRender = render(
      <TribeDetailPage onMembershipUpdated={jest.fn()} user={{ _id: 'u1' }} />,
    );
    firstRender.unmount();
    resolveCircle(tribe);
    await new Promise(resolve => setTimeout(resolve, 0));

    let rejectCircle;
    tribesApi.get.mockReturnValue(
      new Promise((resolve, reject) => {
        rejectCircle = reject;
      }),
    );
    const secondRender = render(
      <TribeDetailPage onMembershipUpdated={jest.fn()} user={{ _id: 'u1' }} />,
    );
    secondRender.unmount();
    rejectCircle(new Error('late failure'));
    await new Promise(resolve => setTimeout(resolve, 0));
  });
});
