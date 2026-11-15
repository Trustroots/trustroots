import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import MemberIdentity from '@/modules/users/client/components/MemberIdentity';

it('shows a name with a handle and an initials fallback', () => {
  render(
    <MemberIdentity
      user={{ displayName: 'Sample Walker', username: 'sample-walker' }}
      size={36}
    />,
  );
  expect(screen.getByText('Sample Walker')).toBeVisible();
  expect(screen.getByText('@sample-walker')).toBeVisible();
  expect(screen.getByText('SW')).toHaveAttribute('aria-hidden', 'true');
});

it('shows the name when the username is missing', () => {
  render(<MemberIdentity user={{ displayName: 'Sample Walker' }} size={36} />);
  expect(screen.getByText('Sample Walker')).toBeVisible();
  expect(screen.queryByText(/^@/)).not.toBeInTheDocument();
});
