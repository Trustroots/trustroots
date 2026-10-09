import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import BoardCredits, {
  type PhotoCredit,
} from '@/modules/core/client/components/BoardCredits';
import { onClientEvent } from '@/modules/core/client/services/client-runtime';

const onClientEventMock = jest.mocked(onClientEvent);

jest.mock('@/modules/core/client/services/client-runtime', () => ({
  onClientEvent: jest.fn(() => () => {}),
}));

describe('<BoardCredits />', () => {
  afterEach(() => {
    onClientEventMock.mockClear();
  });

  function getEventHandler(eventName: string) {
    const registration = onClientEventMock.mock.calls.find(
      ([registeredEvent]) => registeredEvent === eventName,
    );
    if (!registration) throw new Error(`Expected ${eventName} listener`);
    return registration[1];
  }

  it('renders nothing when there are no credits', () => {
    const { container } = render(<BoardCredits photoCredits={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('uses an empty credit list when no photo credits are supplied', () => {
    const { container } = render(<BoardCredits />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a single photo credit', () => {
    render(
      <BoardCredits
        photoCredits={{
          bokeh: {
            name: 'Alice',
            url: 'https://example.com/alice',
            file: 'alice.jpg',
          },
        }}
      />,
    );

    expect(screen.getByText('Photo by')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute(
      'href',
      'https://example.com/alice',
    );
  });

  it('renders multiple photo credits with license links', () => {
    render(
      <BoardCredits
        photoCredits={{
          a: { name: 'Alice', url: 'https://example.com/a', file: 'a.jpg' },
          b: {
            name: 'Bob',
            url: 'https://example.com/b',
            license: 'CC-BY',
            license_url: 'https://example.com/license',
            file: 'b.jpg',
          },
        }}
      />,
    );

    expect(screen.getByText('Photos by')).toBeInTheDocument();
    expect(screen.getByText('CC-BY')).toBeInTheDocument();
  });

  it('adds photo credits from update events', () => {
    render(<BoardCredits photoCredits={{}} />);

    const updatedCredit: Record<string, PhotoCredit> = {
      updated: {
        name: 'Carol',
        url: 'https://example.com/carol',
        file: 'carol.jpg',
      },
    };
    act(() => {
      getEventHandler('photoCreditsUpdated')(null, updatedCredit);
    });

    expect(screen.getByText('Photo by')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Carol' })).toHaveAttribute(
      'href',
      'https://example.com/carol',
    );
  });

  it('removes photo credits from removal events', () => {
    render(
      <BoardCredits
        photoCredits={{
          keep: { name: 'Alice', url: 'https://example.com/a', file: 'a.jpg' },
          remove: { name: 'Bob', url: 'https://example.com/b', file: 'b.jpg' },
        }}
      />,
    );

    act(() => {
      getEventHandler('photoCreditsRemoved')(null, { remove: true });
    });

    expect(screen.getByRole('link', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Bob' })).not.toBeInTheDocument();
  });
});
