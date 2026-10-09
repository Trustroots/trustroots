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
    expect(screen.getByRole('link', { name: 'Member known' })).toHaveAttribute(
      'href',
      '/profile/known',
    );
    expect(
      screen.getByRole('link', { name: 'Member recommender' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Member active' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Member known')).toBeInTheDocument();
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
