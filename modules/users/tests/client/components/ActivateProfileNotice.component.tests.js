import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ActivateProfileNotice from '@/modules/users/client/components/ActivateProfileNotice.component';

describe('ActivateProfileNotice', () => {
  it('renders activation guidance and support links', () => {
    render(<ActivateProfileNotice />);

    expect(screen.getByText("Don't panic!")).toBeInTheDocument();
    expect(
      screen.getByText(
        'Sorry, you need to first activate your profile by confirming your email.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /email settings/i }),
    ).toHaveAttribute('href', '/profile/edit/account');
    expect(screen.getByRole('link', { name: /support/i })).toHaveAttribute(
      'href',
      '/support',
    );
  });
});
