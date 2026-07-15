import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import NoMeets from '@/modules/offers/client/components/NoMeets.component';

describe('<NoMeets />', () => {
  it('shows invitation CTA and visibility note', () => {
    render(<NoMeets />);

    expect(
      screen.getByText(/Travelling\?\s*Organising an event\?/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Add it to map!' }),
    ).toHaveAttribute('href', 'https://nos.trustroots.org/');
    expect(
      screen.getByText('Meetups stay visible on map at most one month.'),
    ).toBeInTheDocument();
  });
});
