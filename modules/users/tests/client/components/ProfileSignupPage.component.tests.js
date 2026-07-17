import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import ProfileSignupPage from '@/modules/users/client/components/ProfileSignupPage.component';

describe('ProfileSignupPage', () => {
  it('renders the signup prompt for anonymous profile visitors', () => {
    render(<ProfileSignupPage />);

    expect(
      screen.getByText(
        'Join our community to connect with this and many more members.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Become a member' }),
    ).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute(
      'href',
      '/signin?continue=true',
    );
  });
});
