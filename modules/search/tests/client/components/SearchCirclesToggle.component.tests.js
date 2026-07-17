import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import SearchCirclesToggle from '@/modules/search/client/components/SearchCirclesToggle.component';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';

jest.mock('@/modules/tribes/client/api/tribes.api');

describe('SearchCirclesToggle', () => {
  const onChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders circle toggles and reports selection changes', async () => {
    tribesApi.read.mockResolvedValue([
      { _id: 'cyclists', label: 'Cyclists' },
      { _id: 'hikers', label: 'Hikers' },
    ]);

    render(
      <SearchCirclesToggle
        onChange={onChange}
        selectedTribeIds={['cyclists']}
      />,
    );

    expect(
      await screen.findByRole('checkbox', { name: 'Cyclists' }),
    ).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Hikers' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Hikers' }));

    expect(onChange).toHaveBeenCalledWith(['cyclists', 'hikers']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hikers' }));
    expect(onChange).toHaveBeenLastCalledWith(['cyclists']);
  });

  it('renders nothing when no circles are available', async () => {
    tribesApi.read.mockResolvedValue([]);

    const { container } = render(
      <SearchCirclesToggle onChange={onChange} selectedTribeIds={[]} />,
    );

    await waitFor(() => {
      expect(tribesApi.read).toHaveBeenCalled();
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when loading circles fails', async () => {
    tribesApi.read.mockRejectedValue(new Error('network'));

    const { container } = render(
      <SearchCirclesToggle onChange={onChange} selectedTribeIds={[]} />,
    );

    await waitFor(() => expect(tribesApi.read).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('handles an empty circle response', async () => {
    tribesApi.read.mockResolvedValue(null);

    const { container } = render(
      <SearchCirclesToggle onChange={onChange} selectedTribeIds={[]} />,
    );

    await waitFor(() => expect(tribesApi.read).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('ignores circle responses after unmounting', async () => {
    let resolveCircles;
    tribesApi.read.mockReturnValue(
      new Promise(resolve => {
        resolveCircles = resolve;
      }),
    );

    const { unmount } = render(
      <SearchCirclesToggle onChange={onChange} selectedTribeIds={[]} />,
    );
    unmount();
    resolveCircles([{ _id: 'cyclists', label: 'Cyclists' }]);

    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores circle failures after unmounting', async () => {
    let rejectCircles;
    tribesApi.read.mockReturnValue(
      new Promise((resolve, reject) => {
        rejectCircles = reject;
      }),
    );

    const { unmount } = render(
      <SearchCirclesToggle onChange={onChange} selectedTribeIds={[]} />,
    );
    unmount();
    rejectCircles(new Error('late failure'));

    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();
  });
});
