import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import CircleMemberDiscovery from '@/modules/tribes/client/components/CircleMemberDiscovery';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';

jest.mock('@/modules/tribes/client/api/tribes.api', () => ({
  listMembers: jest.fn(),
}));

describe('<CircleMemberDiscovery />', () => {
  const circle = { _id: 'circle-1', slug: 'hitchhikers' };
  const user = { _id: 'viewer-1' };
  const member = (id, username) => ({
    _id: id,
    username,
    displayName: `Member ${username}`,
    avatarSource: 'none',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    tribesApi.listMembers.mockResolvedValue({
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
    expect(tribesApi.listMembers).toHaveBeenCalledWith('hitchhikers');
  });

  it('shows an empty state when the discovery request fails', async () => {
    tribesApi.listMembers.mockRejectedValue(new Error('members unavailable'));

    render(<CircleMemberDiscovery circle={circle} user={user} />);

    expect(
      await screen.findByText('No members to show yet'),
    ).toBeInTheDocument();
  });

  it('ignores a result that arrives after the component unmounts', async () => {
    let resolveMembers;
    tribesApi.listMembers.mockReturnValue(
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
    let rejectMembers;
    tribesApi.listMembers.mockReturnValue(
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
