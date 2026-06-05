import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

jest.mock('@/modules/search/client/services/nostr.client.service', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      fetchUserNotes: jest.fn().mockResolvedValue([
        {
          id: 'note1',
          content: 'Great spot near Prague!',
          created_at: Math.floor(Date.now() / 1000) - 86400,
          tags: [],
        },
        {
          id: 'note2',
          content: 'Free camping by the river',
          created_at: Math.floor(Date.now() / 1000) - 172800,
          tags: [],
        },
      ]),
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    })),
  };
});

jest.mock(
  '@/modules/core/client/components/NostrootsActionModal.component',
  () => {
    return { __esModule: true, default: () => null };
  },
);

import ProfileNostrBadge from '@/modules/users/client/components/ProfileNostrBadge.component';

describe('ProfileNostrBadge', () => {
  it('renders badge with "Nostroots" text when user has notes', async () => {
    render(<ProfileNostrBadge npubHex="abc123def456" />);
    await waitFor(() => {
      expect(screen.getByText('Nostroots')).toBeInTheDocument();
    });
  });

  it('renders recent notes content', async () => {
    render(<ProfileNostrBadge npubHex="abc123def456" />);
    await waitFor(() => {
      expect(screen.getByText('Great spot near Prague!')).toBeInTheDocument();
      expect(screen.getByText('Free camping by the river')).toBeInTheDocument();
    });
    expect(screen.getByText('Recent community notes')).toBeInTheDocument();
  });

  it('renders nothing when npubHex is not provided', () => {
    const { container } = render(<ProfileNostrBadge npubHex={null} />);
    expect(container.innerHTML).toBe('');
  });
});
