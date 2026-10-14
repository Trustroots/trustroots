import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import CircleMemberDiscovery from '@/modules/tribes/client/components/CircleMemberDiscovery';
import {
  listMembers,
  type CircleMemberGroups,
  type TribeSummary,
} from '@/modules/tribes/client/api/tribes.api';
import type { UserProfile } from '@/modules/users/client/types';

const listMembersMock = jest.mocked(listMembers);

jest.mock('@/modules/tribes/client/api/tribes.api', () => ({
  listMembers: jest.fn(),
}));

describe('<CircleMemberDiscovery />', () => {
  const circle: TribeSummary = {
    _id: 'circle-1',
    slug: 'hitchhikers',
    label: 'Hitchhikers',
    count: 3,
  };
  const user: UserProfile = {
    _id: 'viewer-1',
    username: 'viewer',
    displayName: 'Circle Viewer',
  };
  const member = (id: string, username: string): UserProfile => ({
    _id: id,
    username,
    displayName: `Member ${username}`,
    locationLiving: 'Example City',
    locationFrom: 'Somewhere',
    tagline: 'Happy to host',
    avatarSource: 'none',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    listMembersMock.mockResolvedValue({
      contacts: [member('contact-1', 'known')],
      recommenders: [
        member('contact-1', 'known'),
        member('recommender-1', 'recommender'),
      ],
      active: [
        member('recommender-1', 'recommender'),
        member('active-1', 'active'),
      ],
    });
  });

  it('renders ordered member summaries and removes duplicates', async () => {
    render(<CircleMemberDiscovery circle={circle} user={user} />);

    const contactsHeading = await screen.findByRole('heading', {
      name: 'Your contacts in this circle',
    });
    const recommendersHeading = screen.getByRole('heading', {
      name: 'People who recommend you',
    });
    const activeHeading = screen.getByRole('heading', {
      name: 'Other active members',
    });
    expect(contactsHeading.compareDocumentPosition(recommendersHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(recommendersHeading.compareDocumentPosition(activeHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByRole('link', { name: /Member known/ })).toHaveAttribute(
      'href',
      '/profile/known',
    );
    expect(
      screen.getByRole('link', { name: /Member recommender/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Member active/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Member known')).toBeInTheDocument();
    expect(screen.getAllByText('Lives in: Example City')).toHaveLength(3);
    expect(screen.getAllByText('From: Somewhere')).toHaveLength(3);
    expect(screen.getAllByText('Happy to host')).toHaveLength(3);
    expect(
      screen.getAllByRole('link', { name: /Member known/ })[0],
    ).toHaveClass('member-search-card');
    expect(listMembersMock).toHaveBeenCalledWith('hitchhikers');
  });

  it('only reloads when the circle or signed-in member changes', async () => {
    const { rerender } = render(
      <CircleMemberDiscovery circle={circle} user={user} />,
    );
    await screen.findByText('Member known');
    rerender(
      <CircleMemberDiscovery circle={{ ...circle }} user={{ ...user }} />,
    );
    expect(listMembersMock).toHaveBeenCalledTimes(1);
    rerender(
      <CircleMemberDiscovery
        circle={{ ...circle, slug: 'cyclists' }}
        user={user}
      />,
    );
    await act(async () => {});
    expect(listMembersMock).toHaveBeenLastCalledWith('cyclists');
    rerender(
      <CircleMemberDiscovery
        circle={circle}
        user={{ ...user, _id: 'viewer-2' }}
      />,
    );
    await act(async () => {});
    expect(listMembersMock).toHaveBeenCalledTimes(3);
  });

  it('shows a recoverable error when the discovery request fails', async () => {
    listMembersMock.mockRejectedValue(new Error('members unavailable'));

    render(<CircleMemberDiscovery circle={circle} user={user} />);

    expect(
      await screen.findByText(
        'Could not load circle members. Please try again.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No members to show yet'),
    ).not.toBeInTheDocument();
    expect(listMembersMock).toHaveBeenCalledTimes(1);
  });

  it('retries a transient server failure once and shows the returned members', async () => {
    jest.useFakeTimers();
    listMembersMock
      .mockRejectedValueOnce(
        Object.assign(new Error('temporarily unavailable'), {
          response: { status: 503 },
        }),
      )
      .mockResolvedValueOnce({
        contacts: [member('contact-1', 'known')],
        recommenders: [],
        active: [],
      });

    try {
      render(<CircleMemberDiscovery circle={circle} user={user} />);
      await act(async () => {
        await Promise.resolve();
        await jest.advanceTimersByTimeAsync(250);
      });

      expect(await screen.findByText('Member known')).toBeInTheDocument();
      expect(listMembersMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([400, 401, 403, 404, 501, 505])(
    'does not retry an HTTP %i response',
    async status => {
      listMembersMock.mockRejectedValue(
        Object.assign(new Error('request rejected'), {
          response: { status },
        }),
      );

      render(<CircleMemberDiscovery circle={circle} user={user} />);

      expect(
        await screen.findByText(
          'Could not load circle members. Please try again.',
        ),
      ).toBeInTheDocument();
      expect(listMembersMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    [
      'an unknown error code',
      Object.assign(new Error('unknown'), { code: 'EOTHER' }),
    ],
    ['a non-object error', 'network unavailable'],
  ])('does not retry %s', async (_description, error) => {
    listMembersMock.mockRejectedValue(error);

    render(<CircleMemberDiscovery circle={circle} user={user} />);

    expect(
      await screen.findByText(
        'Could not load circle members. Please try again.',
      ),
    ).toBeInTheDocument();
    expect(listMembersMock).toHaveBeenCalledTimes(1);
  });

  it('allows a manual retry after the transient retry is exhausted', async () => {
    jest.useFakeTimers();
    listMembersMock
      .mockRejectedValueOnce(
        Object.assign(new Error('network unavailable'), {
          code: 'ERR_NETWORK',
        }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error('network unavailable'), {
          code: 'ERR_NETWORK',
        }),
      )
      .mockResolvedValueOnce({
        contacts: [member('contact-1', 'known')],
        recommenders: [],
        active: [],
      });

    try {
      render(<CircleMemberDiscovery circle={circle} user={user} />);
      await act(async () => {
        await Promise.resolve();
        await jest.advanceTimersByTimeAsync(250);
      });

      expect(
        await screen.findByText(
          'Could not load circle members. Please try again.',
        ),
      ).toBeInTheDocument();
      expect(listMembersMock).toHaveBeenCalledTimes(2);
      expect(
        screen.getByRole('button', { name: 'Try again' }),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('Member known')).toBeInTheDocument();
      expect(listMembersMock).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('abandons a pending retry when the circle changes', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
    listMembersMock
      .mockRejectedValueOnce(
        Object.assign(new Error('network unavailable'), {
          code: 'ERR_NETWORK',
        }),
      )
      .mockResolvedValueOnce({
        contacts: [member('contact-1', 'known')],
        recommenders: [],
        active: [],
      });

    try {
      const { rerender } = render(
        <CircleMemberDiscovery circle={circle} user={user} />,
      );
      await act(async () => {
        await Promise.resolve();
      });
      const retryTimerIndex = setTimeoutSpy.mock.calls.findIndex(
        ([, delay]) => delay === 250,
      );
      expect(retryTimerIndex).toBeGreaterThanOrEqual(0);
      const retryTimer = setTimeoutSpy.mock.results[retryTimerIndex]?.value;
      rerender(
        <CircleMemberDiscovery
          circle={{ ...circle, slug: 'cyclists' }}
          user={user}
        />,
      );
      expect(clearTimeoutSpy).toHaveBeenCalledWith(retryTimer);
      await act(async () => {
        await Promise.resolve();
        await jest.advanceTimersByTimeAsync(250);
      });

      expect(listMembersMock).toHaveBeenNthCalledWith(1, 'hitchhikers');
      expect(listMembersMock).toHaveBeenNthCalledWith(2, 'cyclists');
      expect(listMembersMock).toHaveBeenCalledTimes(2);
      expect(await screen.findByText('Member known')).toBeInTheDocument();
    } finally {
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('abandons a pending retry when the component unmounts', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
    listMembersMock.mockRejectedValueOnce(
      Object.assign(new Error('network unavailable'), { code: 'ERR_NETWORK' }),
    );

    try {
      const { unmount } = render(
        <CircleMemberDiscovery circle={circle} user={user} />,
      );
      await act(async () => {
        await Promise.resolve();
      });
      const retryTimerIndex = setTimeoutSpy.mock.calls.findIndex(
        ([, delay]) => delay === 250,
      );
      expect(retryTimerIndex).toBeGreaterThanOrEqual(0);
      const retryTimer = setTimeoutSpy.mock.results[retryTimerIndex]?.value;
      unmount();
      expect(clearTimeoutSpy).toHaveBeenCalledWith(retryTimer);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(250);
      });

      expect(listMembersMock).toHaveBeenCalledTimes(1);
    } finally {
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('retries a failed request and shows the returned members', async () => {
    listMembersMock.mockRejectedValueOnce(new Error('unavailable'));
    render(<CircleMemberDiscovery circle={circle} user={user} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Member known')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(listMembersMock).toHaveBeenCalledTimes(2);
  });

  it('shows the empty state only after a successful empty response', async () => {
    listMembersMock.mockResolvedValue({
      contacts: [],
      recommenders: [],
      active: [],
    });
    render(<CircleMemberDiscovery circle={circle} user={user} />);
    expect(
      await screen.findByText('No members to show yet'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ignores a result that arrives after the component unmounts', async () => {
    let resolveMembers!: (groups: CircleMemberGroups) => void;
    listMembersMock.mockReturnValue(
      new Promise(resolve => {
        resolveMembers = resolve;
      }),
    );
    const { unmount } = render(
      <CircleMemberDiscovery circle={circle} user={user} />,
    );
    unmount();

    await act(async () =>
      resolveMembers({ contacts: [], recommenders: [], active: [] }),
    );
  });

  it('ignores an error that arrives after the component unmounts', async () => {
    let rejectMembers!: (error: Error) => void;
    listMembersMock.mockReturnValue(
      new Promise((_, reject) => {
        rejectMembers = reject;
      }),
    );
    const { unmount } = render(
      <CircleMemberDiscovery circle={circle} user={user} />,
    );
    unmount();

    await act(async () => rejectMembers(new Error('late failure')));
  });
});
