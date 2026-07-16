import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

jest.mock('@/modules/search/client/services/nostr.client.service', () => ({
  __esModule: true,
  default: class NostrService {},
  nostrService: {
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
  },
}));

jest.mock(
  '@/modules/core/client/components/NostrootsActionModal.component',
  () => {
    const PropTypes = require('prop-types');

    function MockNostrootsActionModal({ isOpen, onClose }) {
      if (!isOpen) return null;
      return (
        <div data-testid="nostroots-modal">
          <button type="button" onClick={onClose}>
            Close modal
          </button>
        </div>
      );
    }

    MockNostrootsActionModal.propTypes = {
      isOpen: PropTypes.bool,
      onClose: PropTypes.func,
    };

    return { __esModule: true, default: MockNostrootsActionModal };
  },
);

const ProfileNostrBadge =
  require('@/modules/users/client/components/ProfileNostrBadge.component').default;
const {
  nostrService,
} = require('@/modules/search/client/services/nostr.client.service');

describe('ProfileNostrBadge', () => {
  beforeEach(() => {
    nostrService.fetchUserNotes.mockClear();
    nostrService.fetchUserNotes.mockResolvedValue([
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
    ]);
  });

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
    expect(container).toBeEmptyDOMElement();
  });

  it('opens and closes the Nostroots action modal from the notes link', async () => {
    render(<ProfileNostrBadge npubHex="abc123def456" />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: /See all notes on Nostroots/,
      }),
    );

    expect(screen.getByTestId('nostroots-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));

    expect(screen.queryByTestId('nostroots-modal')).not.toBeInTheDocument();
  });

  it('renders nothing when note fetching fails', async () => {
    nostrService.fetchUserNotes.mockRejectedValueOnce(
      new Error('relay unavailable'),
    );

    const { container } = render(<ProfileNostrBadge npubHex="abc123def456" />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('ignores note results that arrive after unmount', async () => {
    let resolveNotes;
    nostrService.fetchUserNotes.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveNotes = resolve;
        }),
    );

    const { unmount } = render(<ProfileNostrBadge npubHex="abc123def456" />);

    unmount();

    resolveNotes([
      {
        id: 'late-note',
        content: 'Late note',
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
      },
    ]);
    await Promise.resolve();
  });
});
