import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import SearchMyCirclesToggle from '@/modules/search/client/components/SearchMyCirclesToggle.component';
import { listMemberships } from '@/modules/tribes/client/api/tribes.api';

jest.mock('@/modules/tribes/client/api/tribes.api');

describe('SearchMyCirclesToggle', () => {
  const onChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prompts members without circles to join circles', async () => {
    listMemberships.mockResolvedValue([]);

    render(<SearchMyCirclesToggle onChange={onChange} selectedTribeIds={[]} />);

    expect(
      await screen.findByRole('link', {
        name: /join circles to find similar members/i,
      }),
    ).toHaveAttribute('href', '/circles');
  });

  it('filters search results to the member circles when enabled', async () => {
    listMemberships.mockResolvedValue([
      { tribe: { _id: 'tribe-1' } },
      { tribe: { _id: 'tribe-2' } },
    ]);

    render(<SearchMyCirclesToggle onChange={onChange} selectedTribeIds={[]} />);

    const toggle = await screen.findByRole('checkbox', {
      name: /show only members from my circles/i,
    });
    expect(toggle.nextElementSibling).toHaveClass('toggle');

    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith(['tribe-1', 'tribe-2']);
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('handles an empty membership response', async () => {
    listMemberships.mockResolvedValue(null);

    render(<SearchMyCirclesToggle onChange={onChange} selectedTribeIds={[]} />);

    expect(
      await screen.findByRole('link', {
        name: /join circles to find similar members/i,
      }),
    ).toBeInTheDocument();
  });

  it('uses singular copy when the member belongs to one circle', async () => {
    listMemberships.mockResolvedValue([{ tribe: { _id: 'tribe-1' } }]);

    render(<SearchMyCirclesToggle onChange={onChange} selectedTribeIds={[]} />);

    expect(
      await screen.findByRole('checkbox', {
        name: /show only members from my circle/i,
      }),
    ).toBeInTheDocument();
  });

  it('ignores membership results after unmounting', async () => {
    listMemberships.mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(() => resolve([{ tribe: { _id: 'tribe-1' } }]), 50);
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
    listMemberships.mockResolvedValue([
      { tribe: { _id: 'tribe-1' } },
      { tribe: { _id: 'tribe-2' } },
    ]);

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
