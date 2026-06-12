import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import SubmittedInfo from '@/modules/experiences/client/components/create-experience/SubmittedInfo';

describe('<SubmittedInfo />', () => {
  it('renders public experience confirmation and profile link', () => {
    render(
      <SubmittedInfo
        isPublic={true}
        isReported={false}
        name="Mira"
        username="mira"
      />,
    );

    expect(
      screen.getByText('Your experience with Mira is public now.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'See their experiences' }),
    ).toHaveAttribute('href', '/profile/mira/experiences');
    expect(screen.queryByText(/reported them/)).not.toBeInTheDocument();
  });

  it('renders delayed public copy and report follow-up link', () => {
    render(
      <SubmittedInfo
        isPublic={false}
        isReported={true}
        name="Mira"
        username="mira"
      />,
    );

    expect(
      screen.getByText(
        'Your experience will become public when Mira shares their experience, or at most in 14 days.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'get in touch with us' }),
    ).toHaveAttribute('href', '/support');
  });
});
