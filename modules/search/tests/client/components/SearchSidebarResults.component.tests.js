import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import SearchSidebarResults, {
  OfferDescription,
  formatAge,
} from '@/modules/search/client/components/SearchSidebarResults.component';

jest.mock('@/modules/core/client/api/languages.api', () => ({
  useLanguagesQuery: () => ({
    data: { en: 'English', fi: 'Finnish' },
  }),
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

  it('renders no description when an offer has none', () => {
    const { container } = render(
      <OfferDescription description="" offerType="host" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the empty state when nothing is selected', () => {
    render(<SearchSidebarResults onCloseSidebar={jest.fn()} />);

    expect(
      screen.getByText(/choose something from the map/i),
    ).toBeInTheDocument();
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
});
