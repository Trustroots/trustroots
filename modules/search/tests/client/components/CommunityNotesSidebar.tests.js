import React from 'react';
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

jest.mock('@/modules/search/client/services/nostr.client.service', () => ({
  __esModule: true,
  default: class NostrService {},
  nostrService: {
    resolveNpubToUsername: jest.fn(pubkey => {
      if (pubkey.startsWith('pubkey1111')) {
        return Promise.resolve('alice');
      }
      return Promise.resolve(null);
    }),
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

const CommunityNotesSidebar =
  require('@/modules/search/client/components/CommunityNotesSidebar.component').default;
const {
  nostrService,
} = require('@/modules/search/client/services/nostr.client.service');

const NOTES = [
  {
    id: 'note-older',
    content: 'Older note at this spot',
    pubkey: 'validationserver1111111111111111111111111111111111111111111111',
    authorPubkey:
      'pubkey1111111111111111111111111111111111111111111111111111111111',
    created_at: Math.floor(Date.now() / 1000) - 7200,
    tags: [],
  },
  {
    id: 'note-newer',
    content: 'Newer note at this spot',
    pubkey: 'pubkey2222222222222222222222222222222222222222222222222222222222',
    created_at: Math.floor(Date.now() / 1000) - 60,
    tags: [],
  },
];

describe('CommunityNotesSidebar', () => {
  beforeEach(() => {
    nostrService.resolveNpubToUsername.mockClear();
    nostrService.resolveNpubToUsername.mockImplementation(pubkey => {
      if (pubkey.startsWith('pubkey1111')) {
        return Promise.resolve('alice');
      }
      return Promise.resolve(null);
    });
  });

  it('renders thread header with note count and plus code', () => {
    render(<CommunityNotesSidebar notes={NOTES} plusCode="9F2X+3Q" />);

    expect(screen.getByText('Community Notes')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('9F2X+3Q')).toBeInTheDocument();
  });

  it('renders notes sorted newest first', () => {
    render(<CommunityNotesSidebar notes={NOTES} plusCode="9F2X+3Q" />);

    const contents = screen.getAllByText(/note at this spot/);
    expect(contents[0]).toHaveTextContent('Newer note at this spot');
    expect(contents[1]).toHaveTextContent('Older note at this spot');
  });

  it('resolves author usernames and links to profiles', async () => {
    render(<CommunityNotesSidebar notes={NOTES} plusCode="9F2X+3Q" />);

    await waitFor(() => {
      expect(nostrService.resolveNpubToUsername).toHaveBeenCalledWith(
        'pubkey1111111111111111111111111111111111111111111111111111111111',
      );
      expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute(
        'href',
        '/profile/alice',
      );
    });
  });

  it('opens the Nostroots action modal when Reply is clicked', () => {
    render(<CommunityNotesSidebar notes={NOTES} plusCode="9F2X+3Q" />);

    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));

    expect(screen.getByTestId('nostroots-modal')).toBeInTheDocument();
  });

  it('closes the Nostroots action modal', () => {
    render(<CommunityNotesSidebar notes={NOTES} plusCode="9F2X+3Q" />);

    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));

    expect(screen.queryByTestId('nostroots-modal')).not.toBeInTheDocument();
  });

  it('renders nothing when notes are empty', () => {
    const { container } = render(
      <CommunityNotesSidebar notes={[]} plusCode="9F2X+3Q" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when notes are missing', () => {
    const { container } = render(<CommunityNotesSidebar plusCode="9F2X+3Q" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not resolve usernames when notes have no author pubkey', () => {
    render(
      <CommunityNotesSidebar
        notes={[
          {
            id: 'note-without-author',
            content: 'Anonymous-looking note',
            pubkey: '',
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
          },
        ]}
        plusCode="9F2X+3Q"
      />,
    );

    expect(nostrService.resolveNpubToUsername).not.toHaveBeenCalled();
  });

  it('keeps the pubkey fallback when username lookup fails', async () => {
    nostrService.resolveNpubToUsername.mockRejectedValueOnce(
      new Error('relay unavailable'),
    );

    render(<CommunityNotesSidebar notes={NOTES} plusCode="9F2X+3Q" />);

    await waitFor(() =>
      expect(nostrService.resolveNpubToUsername).toHaveBeenCalled(),
    );
    expect(screen.getByText('pubkey222222...')).toBeInTheDocument();
  });

  it('ignores username lookups that settle after unmount', async () => {
    let resolveLookup;
    nostrService.resolveNpubToUsername.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveLookup = resolve;
        }),
    );

    const { unmount } = render(
      <CommunityNotesSidebar notes={NOTES} plusCode="9F2X+3Q" />,
    );

    unmount();

    await act(async () => {
      resolveLookup('alice');
      await Promise.resolve();
    });

    expect(nostrService.resolveNpubToUsername).toHaveBeenCalled();
  });
});
