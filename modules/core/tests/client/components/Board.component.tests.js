import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import Board from '@/modules/core/client/components/Board';
import { broadcastClientEvent } from '@/modules/core/client/services/client-runtime';

jest.mock('@/modules/core/client/services/client-runtime', () => ({
  broadcastClientEvent: jest.fn(),
}));

describe('<Board />', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders children, classes, and selected photo background', async () => {
    render(
      <Board
        className="board-primary"
        data-testid="board"
        ignoreBackgroundOnSmallScreen
        names="bokeh"
      >
        <span>Board content</span>
      </Board>,
    );

    const board = screen.getByTestId('board');

    expect(screen.getByText('Board content')).toBeInTheDocument();
    expect(board).toHaveClass('board', 'board-primary');
    expect(board).toHaveClass('small-screen-bad-background');
    await waitFor(() =>
      expect(board).toHaveStyle({
        backgroundImage: 'url("/img/board/flickr-bokeh.jpg")',
      }),
    );
    expect(broadcastClientEvent).toHaveBeenCalledWith(
      'photoCreditsUpdated',
      expect.objectContaining({
        bokeh: expect.objectContaining({
          imageUrl: '/img/board/flickr-bokeh.jpg',
        }),
      }),
    );
  });

  it('uses a provided style object and removes credits on unmount', async () => {
    const style = { minHeight: 120 };

    const { unmount } = render(
      <Board data-testid="board" names="bokeh" style={style}>
        Styled board
      </Board>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('board')).toHaveStyle({
        minHeight: '120px',
        backgroundImage: 'url("/img/board/flickr-bokeh.jpg")',
      }),
    );

    unmount();

    expect(broadcastClientEvent).toHaveBeenCalledWith(
      'photoCreditsRemoved',
      expect.objectContaining({
        bokeh: expect.objectContaining({
          imageUrl: '/img/board/flickr-bokeh.jpg',
        }),
      }),
    );
  });

  it('accepts an array of board photo names', async () => {
    render(
      <Board data-testid="board" names={['bokeh']}>
        Array board
      </Board>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('board')).toHaveStyle({
        backgroundImage: 'url("/img/board/flickr-bokeh.jpg")',
      }),
    );
    expect(broadcastClientEvent).toHaveBeenCalledWith(
      'photoCreditsUpdated',
      expect.objectContaining({
        bokeh: expect.objectContaining({
          imageUrl: '/img/board/flickr-bokeh.jpg',
        }),
      }),
    );
  });

  it('uses the default board photo name when no name is provided', async () => {
    render(<Board data-testid="board">Default board</Board>);

    await waitFor(() =>
      expect(screen.getByTestId('board')).toHaveStyle({
        backgroundImage: 'url("/img/board/flickr-bokeh.jpg")',
      }),
    );
  });
});
