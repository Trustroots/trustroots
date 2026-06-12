import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import MeetsExplanation from '@/modules/offers/client/components/MeetsExplanation.component';

describe('<MeetsExplanation />', () => {
  it('explains what meetups are and when they expire', () => {
    render(<MeetsExplanation />);

    expect(
      screen.getByText(
        'Travelling? Organising an event? Just making a dinner and would like to invite people over?',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Meetups stay visible on map at most one month.'),
    ).toBeInTheDocument();
  });
});
