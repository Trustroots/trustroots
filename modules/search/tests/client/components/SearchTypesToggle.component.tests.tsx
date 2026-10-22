import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import SearchTypesToggle from '@/modules/search/client/components/SearchTypesToggle.component';

type ChangeHandler = React.ComponentProps<typeof SearchTypesToggle>['onChange'];

describe('SearchTypesToggle', () => {
  it('disables hosts and keeps meetups only', () => {
    const onChange = jest.fn<
      ReturnType<ChangeHandler>,
      Parameters<ChangeHandler>
    >();

    render(<SearchTypesToggle onChange={onChange} types={['host', 'meet']} />);

    const hostsToggle = screen.getByRole('checkbox', { name: 'Hosts' });
    expect(hostsToggle).toBeChecked();
    expect(hostsToggle.nextElementSibling).toHaveClass('toggle');

    fireEvent.click(hostsToggle);

    expect(onChange).toHaveBeenCalledWith(['meet']);
  });

  it('enables hosts together with meetups', () => {
    const onChange = jest.fn<
      ReturnType<ChangeHandler>,
      Parameters<ChangeHandler>
    >();

    render(<SearchTypesToggle onChange={onChange} types={['meet']} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Hosts' }));

    expect(onChange).toHaveBeenCalledWith(['host', 'meet']);
  });
  it('allows host-only discovery and keeps at least one type selected', () => {
    const onChange = jest.fn();
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
});
