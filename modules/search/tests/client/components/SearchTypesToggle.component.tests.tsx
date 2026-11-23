import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SearchTypesToggle from '@/modules/search/client/components/SearchTypesToggle.component';

type ChangeHandler = React.ComponentProps<typeof SearchTypesToggle>['onChange'];

describe('SearchTypesToggle', () => {
  it('disables hosts and keeps meetups only', () => {
    const onChange =
      vi.fn<
        (...args: Parameters<ChangeHandler>) => ReturnType<ChangeHandler>
      >();

    render(<SearchTypesToggle onChange={onChange} types={['host', 'meet']} />);

    const hostsToggle = screen.getByRole('checkbox', { name: 'Hosts' });
    expect(hostsToggle).toBeChecked();

    fireEvent.click(hostsToggle);

    expect(onChange).toHaveBeenCalledWith(['meet']);
  });

  it('enables hosts together with meetups', () => {
    const onChange =
      vi.fn<
        (...args: Parameters<ChangeHandler>) => ReturnType<ChangeHandler>
      >();

    render(<SearchTypesToggle onChange={onChange} types={['meet']} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Hosts' }));

    expect(onChange).toHaveBeenCalledWith(['host', 'meet']);
  });
  it('allows host-only discovery and keeps at least one type selected', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SearchTypesToggle onChange={onChange} types={['host', 'meet']} />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Meetings' }));
    expect(onChange).toHaveBeenCalledWith(['host']);
    rerender(<SearchTypesToggle onChange={onChange} types={['host']} />);
    expect(screen.getByRole('checkbox', { name: 'Hosts' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Meetings' }));
    expect(onChange).toHaveBeenLastCalledWith(['host', 'meet']);
  });

  it('shows in-view counts for enabled layers, including zero results', () => {
    render(
      <SearchTypesToggle
        counts={{ host: 0, meet: 4 }}
        onChange={vi.fn()}
        types={['host']}
      />,
    );

    expect(
      screen.getByRole('checkbox', { name: 'Hosts' }),
    ).toHaveAccessibleDescription('Map results 0');
    expect(
      screen.getByRole('checkbox', { name: 'Meetings' }),
    ).not.toHaveAccessibleDescription();
  });
});
