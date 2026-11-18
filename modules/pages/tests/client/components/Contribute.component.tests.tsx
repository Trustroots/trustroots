import React from 'react';
import { render, screen } from '@testing-library/react';

import '@/config/client/i18n';
import Contribute from '@/modules/pages/client/components/Contribute.component';
import type PageBoard from '@/modules/pages/client/components/PageBoard';

type BoardProps = React.ComponentProps<typeof PageBoard>;

vi.mock('@/modules/core/client/components/Board', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  function MockBoard({ children }: BoardProps) {
    return <div>{children}</div>;
  }

  return { default: MockBoard };
});

describe('<Contribute />', () => {
  it('renders the funding headline and trustroots foundation link', () => {
    render(<Contribute />);

    expect(
      screen.getByRole('heading', { name: 'Support Trustroots' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'foundation' })).toHaveAttribute(
      'href',
      '/foundation',
    );
  });
});
