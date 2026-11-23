import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SearchFilterSwitch from '@/modules/search/client/components/SearchFilterSwitch.component';

describe('<SearchFilterSwitch />', () => {
  it('describes zero map results separately from the filter name', () => {
    const onChange = vi.fn();
    render(
      <SearchFilterSwitch checked count={0} onChange={onChange}>
        Hosts
      </SearchFilterSwitch>,
    );

    const filter = screen.getByRole('checkbox', { name: 'Hosts' });
    expect(filter).toHaveAccessibleDescription('Map results 0');
    expect(filter).toBeChecked();
    filter.focus();
    expect(filter).toHaveFocus();
    fireEvent.click(filter);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('omits unavailable counts from disabled filters', () => {
    render(
      <SearchFilterSwitch checked={false} disabled onChange={vi.fn()}>
        Community Notes
      </SearchFilterSwitch>,
    );

    const filter = screen.getByRole('checkbox', { name: 'Community Notes' });
    expect(filter).toBeDisabled();
    expect(filter).not.toHaveAccessibleDescription();
  });
});
