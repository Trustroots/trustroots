import React, { type PropsWithChildren } from 'react';
import { render, screen } from '@testing-library/react';

import '@/config/client/i18n';
import Guide from '@/modules/pages/client/components/Guide.component';

vi.mock('@/modules/core/client/components/Board.js', async () => {
  const actualReact = await vi.importActual<typeof import('react')>('react');

  function MockBoard({ children }: PropsWithChildren) {
    return actualReact.createElement('div', null, children);
  }

  return { default: MockBoard };
});

describe('<Guide />', () => {
  it('renders key guidance sections and editor actions', () => {
    render(<Guide />);

    expect(
      screen.getByRole('heading', { name: 'Trustroots Guide' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Make sure your profile is complete',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Fill your profile' }),
    ).toHaveAttribute('href', '/profile/edit');
    expect(screen.getByRole('link', { name: 'Find members' })).toHaveAttribute(
      'href',
      '/search',
    );
  });
});
