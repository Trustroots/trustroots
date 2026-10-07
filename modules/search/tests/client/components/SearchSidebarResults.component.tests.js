import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import SearchSidebarResults, {
  OfferDescription,
  formatAge,
} from '@/modules/search/client/components/SearchSidebarResults.component';

let mockLanguagesData = { en: 'English', fi: 'Finnish' };

jest.mock('@/modules/core/client/api/languages.api', () => ({
  useLanguagesQuery: () => ({ data: mockLanguagesData }),
}));

jest.mock('@/modules/users/client/components/Avatar.component', () => ({
  __esModule: true,
  default: () => <span data-testid="avatar" />,
}));

jest.mock(
  '@/modules/search/client/components/CommunityNotesSidebar.component',
  () => ({
    __esModule: true,
    default: ({ plusCode }) => (
      <div data-testid="community-notes-sidebar">{plusCode}</div>
    ),
  }),
);

describe('<SearchSidebarResults />', () => {
  beforeEach(() => {
    mockLanguagesData = { en: 'English', fi: 'Finnish' };
  });

  it('returns an empty age for a missing birthday', () => {
    expect(formatAge()).toBe('');
  });

  it('subtracts a year before a birthday in the current month', () => {
    const today = new Date();
    const birthday = new Date(
      today.getFullYear() - 30,
      today.getMonth(),
      today.getDate() + 1,
    );

    expect(formatAge(birthday.toISOString())).toBe(29);
  });

  it('keeps the full age on the birthday itself', () => {
    const today = new Date();
    const birthday = new Date(
      today.getFullYear() - 30,
      today.getMonth(),
      today.getDate(),
    );

    expect(formatAge(birthday.toISOString())).toBe(30);
  });

  it('renders no description when an offer has none', () => {
    const { container } = render(
      <OfferDescription description="" offerType="host" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the empty state when nothing is selected', () => {
    render(<SearchSidebarResults onCloseSidebar={jest.fn()} />);

    expect(screen.getByText(/no results are visible/i)).toBeInTheDocument();
  });

  it('lists visible offers and opens the selected offer details', () => {
    const onOfferSelect = jest.fn();
    const visibleOffer = {
      _id: 'offer-1',
      type: 'host',
      status: 'yes',
      user: { username: 'anonymous-host', displayName: 'A Host' },
    };

    render(
      <SearchSidebarResults
        offers={[visibleOffer]}
        onOfferSelect={onOfferSelect}
        onCloseSidebar={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /open hosting offer from a host/i }),
    );

    expect(onOfferSelect).toHaveBeenCalledWith(visibleOffer);
  });

  it('lists visible community note threads and opens the selected thread', () => {
    const onCommunityNoteSelect = jest.fn();
    const thread = {
      plusCode: '9F2X+XX',
      notes: [{ id: 'note-1', content: 'A useful local note' }],
    };

    render(
      <SearchSidebarResults
        communityNoteThreads={[thread]}
        onCommunityNoteSelect={onCommunityNoteSelect}
        onCloseSidebar={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /community note thread at 9f2x\+xx/i,
      }),
    );

    expect(onCommunityNoteSelect).toHaveBeenCalledWith(thread);
    expect(screen.getByText(/a useful local note/i)).toBeInTheDocument();
  });

  it('labels a meet result by username when the profile has no display name', () => {
    const onOfferSelect = jest.fn();

    render(
      <SearchSidebarResults
        offers={[
          {
            _id: 'meet-offer',
            type: 'meet',
            user: { username: 'meet-member' },
          },
        ]}
        onOfferSelect={onOfferSelect}
        onCloseSidebar={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Open meet offer from meet-member' }),
    );
    expect(onOfferSelect).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'meet-offer', type: 'meet' }),
    );
  });

  it('keeps a community note result usable when its location or text is missing', () => {
    const onCommunityNoteSelect = jest.fn();
    const thread = {
      plusCode: null,
      notes: [{ id: 'unlocated-note' }],
    };

    render(
      <SearchSidebarResults
        communityNoteThreads={[thread]}
        onCommunityNoteSelect={onCommunityNoteSelect}
        onCloseSidebar={jest.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open community note thread at map location',
      }),
    );
    expect(screen.getByText('Open note thread')).toBeInTheDocument();
    expect(onCommunityNoteSelect).toHaveBeenCalledWith(thread);
  });

  it('allows optional result callbacks to be omitted', () => {
    const result = {
      _id: 'offer-optional-callback',
      type: 'host',
      user: { username: 'anonymous-host' },
    };
    const noteThread = {
      plusCode: '9F2X+XX',
      notes: [{ id: 'note-optional-callback' }],
    };

    const offerList = render(
      <SearchSidebarResults offers={[result]} onCloseSidebar={jest.fn()} />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /open hosting offer from/i }),
    );
    offerList.unmount();

    const noteList = render(
      <SearchSidebarResults
        communityNoteThreads={[noteThread]}
        onCloseSidebar={jest.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /community note thread/i }),
    );
    noteList.unmount();

    render(
      <SearchSidebarResults
        offer={result}
        offers={[result]}
        onCloseSidebar={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back to results' }));
  });

  it('shows a loading placeholder while an offer is loading', () => {
    render(<SearchSidebarResults isLoadingOffer onCloseSidebar={jest.fn()} />);

    expect(document.querySelector('.panel-loading')).toBeInTheDocument();
  });

  it('renders a selected offer with languages and metadata', () => {
    render(
      <SearchSidebarResults
        offer={{
          _id: 'offer-1',
          type: 'host',
          status: 'yes',
          description: 'A'.repeat(1200),
          user: {
            username: 'river',
            displayName: 'River Host',
            birthdate: '1990-01-15T00:00:00.000Z',
            gender: 'other',
            tagline: 'Happy to host',
            languages: ['en', 'fi'],
          },
        }}
        onCloseSidebar={jest.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: /river host/i })).toHaveAttribute(
      'href',
      '/profile/river',
    );
    expect(screen.getByText('Happy to host')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Finnish')).toBeInTheDocument();
    expect(screen.getByText(/show more/i)).toBeInTheDocument();
  });

  it('renders meet offers without truncating short descriptions', () => {
    render(
      <SearchSidebarResults
        offer={{
          _id: 'offer-2',
          type: 'meet',
          description: 'Coffee tomorrow',
          updated: '2024-06-01T12:00:00.000Z',
          user: {
            username: 'morgan',
            displayName: 'Morgan Meet',
          },
        }}
        onCloseSidebar={jest.fn()}
      />,
    );

    expect(screen.getByText('Coffee tomorrow')).toBeInTheDocument();
    expect(screen.getByText(/updated/i)).toBeInTheDocument();
  });

  it('renders community notes and closes from the mobile button', () => {
    const onCloseSidebar = jest.fn();

    render(
      <SearchSidebarResults
        communityNote={{
          notes: [{ id: 'note-1' }],
          plusCode: '9F2X+XX',
        }}
        onCloseSidebar={onCloseSidebar}
      />,
    );

    expect(screen.getByTestId('community-notes-sidebar')).toHaveTextContent(
      '9F2X+XX',
    );

    fireEvent.click(screen.getByRole('button', { name: /back to map/i }));

    expect(onCloseSidebar).toHaveBeenCalled();
  });

  it('renders maybe hosting offers and gender-only metadata', () => {
    render(
      <SearchSidebarResults
        offer={{
          _id: 'offer-3',
          type: 'host',
          status: 'maybe',
          description: 'Short description',
          user: {
            username: 'river',
            displayName: 'River Host',
            gender: 'female',
          },
        }}
        onCloseSidebar={jest.fn()}
      />,
    );

    expect(screen.getByText('maybe')).toBeInTheDocument();
    expect(screen.getByText('female.')).toBeInTheDocument();
  });

  it('handles missing descriptions and birthdays before their anniversary', () => {
    render(
      <SearchSidebarResults
        offer={{
          _id: 'offer-4',
          type: 'host',
          status: 'no',
          user: {
            username: 'future',
            displayName: 'Future Host',
            birthdate: '2099-12-31T00:00:00.000Z',
          },
        }}
        onCloseSidebar={jest.fn()}
      />,
    );

    expect(screen.getByText('Future Host')).toBeInTheDocument();
  });

  it('falls back to a language code that has no display name', () => {
    render(
      <SearchSidebarResults
        offer={{
          _id: 'offer-5',
          type: 'host',
          status: 'yes',
          user: {
            username: 'language-fallback',
            displayName: 'Language Fallback',
            languages: ['zz'],
          },
        }}
        onCloseSidebar={jest.fn()}
      />,
    );

    expect(screen.getByText('zz')).toBeInTheDocument();
  });

  it('renders an offer while the language names are not loaded', () => {
    mockLanguagesData = undefined;

    render(
      <SearchSidebarResults
        offer={{
          type: 'meet',
          user: { username: 'language-wait', languages: ['en'] },
        }}
        onCloseSidebar={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('link', { name: /language-wait/ }),
    ).toBeInTheDocument();
  });
});
