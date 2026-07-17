import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import axios from 'axios';
import SearchMyCirclesToggle from '@/modules/search/client/components/SearchMyCirclesToggle.component';

jest.mock('axios');

describe('SearchMyCirclesToggle', () => {
  const onChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prompts members without circles to join circles', async () => {
    axios.get.mockResolvedValue({ data: [] });

    render(<SearchMyCirclesToggle onChange={onChange} selectedTribeIds={[]} />);

    expect(
      await screen.findByRole('link', {
        name: /join circles to find similar members/i,
      }),
    ).toHaveAttribute('href', '/circles');
  });

  it('filters search results to the member circles when enabled', async () => {
    axios.get.mockResolvedValue({
      data: [{ tribe: { _id: 'tribe-1' } }, { tribe: { _id: 'tribe-2' } }],
    });

    render(<SearchMyCirclesToggle onChange={onChange} selectedTribeIds={[]} />);

    const toggle = await screen.findByRole('checkbox', {
      name: /show only members from my circles/i,
    });

    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith(['tribe-1', 'tribe-2']);
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('handles an empty membership response', async () => {
    axios.get.mockResolvedValue({ data: null });

    render(<SearchMyCirclesToggle onChange={onChange} selectedTribeIds={[]} />);

    expect(
      await screen.findByRole('link', {
        name: /join circles to find similar members/i,
      }),
    ).toBeInTheDocument();
  });

  it('uses singular copy when the member belongs to one circle', async () => {
    axios.get.mockResolvedValue({
      data: [{ tribe: { _id: 'tribe-1' } }],
    });

    render(<SearchMyCirclesToggle onChange={onChange} selectedTribeIds={[]} />);

    expect(
      await screen.findByRole('checkbox', {
        name: /show only members from my circle/i,
      }),
    ).toBeInTheDocument();
  });

  it('ignores membership results after unmounting', async () => {
    axios.get.mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(
            () => resolve({ data: [{ tribe: { _id: 'tribe-1' } }] }),
            50,
          );
        }),
    );

    const { unmount } = render(
      <SearchMyCirclesToggle onChange={onChange} selectedTribeIds={[]} />,
    );

    unmount();
    await new Promise(resolve => setTimeout(resolve, 75));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables the toggle when a selected circle is removed from membership', async () => {
    axios.get.mockResolvedValue({
      data: [{ tribe: { _id: 'tribe-1' } }, { tribe: { _id: 'tribe-2' } }],
    });

    const { rerender } = render(
      <SearchMyCirclesToggle onChange={onChange} selectedTribeIds={[]} />,
    );
    const toggle = await screen.findByRole('checkbox');
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();

    rerender(
      <SearchMyCirclesToggle
        onChange={onChange}
        selectedTribeIds={['outside-circle']}
      />,
    );

    expect(toggle).not.toBeChecked();
  });
});
