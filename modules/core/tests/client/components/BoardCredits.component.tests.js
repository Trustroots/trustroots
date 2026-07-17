import React from 'react';
import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import BoardCredits from '@/modules/core/client/components/BoardCredits';
import { onClientEvent } from '@/modules/core/client/services/client-runtime';

jest.mock('@/modules/core/client/services/client-runtime', () => ({
  onClientEvent: jest.fn(() => () => {}),
}));

describe('<BoardCredits />', () => {
  afterEach(() => {
    onClientEvent.mockClear();
  });

  function getEventHandler(eventName) {
    return onClientEvent.mock.calls.find(
      ([registeredEvent]) => registeredEvent === eventName,
    )[1];
  }

  it('renders nothing when there are no credits', () => {
    const { container } = render(<BoardCredits photoCredits={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a single photo credit', () => {
    render(
      <BoardCredits
        photoCredits={{
          bokeh: { name: 'Alice', url: 'https://example.com/alice' },
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
          a: { name: 'Alice', url: 'https://example.com/a' },
          b: {
            name: 'Bob',
            url: 'https://example.com/b',
            license: 'CC-BY',
            license_url: 'https://example.com/license',
          },
        }}
      />,
    );

    expect(screen.getByText('Photos by')).toBeInTheDocument();
    expect(screen.getByText('CC-BY')).toBeInTheDocument();
  });

  it('adds photo credits from update events', () => {
    render(<BoardCredits photoCredits={{}} />);

    act(() => {
      getEventHandler('photoCreditsUpdated')(null, {
        updated: { name: 'Carol', url: 'https://example.com/carol' },
      });
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
          keep: { name: 'Alice', url: 'https://example.com/a' },
          remove: { name: 'Bob', url: 'https://example.com/b' },
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
