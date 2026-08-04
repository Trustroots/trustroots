import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import SearchTypesToggle from '@/modules/search/client/components/SearchTypesToggle.component';

describe('SearchTypesToggle', () => {
  it('disables hosts and keeps meetups only', () => {
    const onChange = jest.fn();

    render(<SearchTypesToggle onChange={onChange} types={['host', 'meet']} />);

    const hostsToggle = screen.getByRole('checkbox', { name: 'Hosts' });
    expect(hostsToggle).toBeChecked();
    expect(hostsToggle.nextElementSibling).toHaveClass('toggle');

    fireEvent.click(hostsToggle);

    expect(onChange).toHaveBeenCalledWith(['meet']);
  });

  it('enables hosts together with meetups', () => {
    const onChange = jest.fn();

    render(<SearchTypesToggle onChange={onChange} types={['meet']} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Hosts' }));

    expect(onChange).toHaveBeenCalledWith(['host', 'meet']);
  });
});
