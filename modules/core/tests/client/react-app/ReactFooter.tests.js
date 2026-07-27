import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import ReactFooter from '@/modules/core/client/react-app/ReactFooter';

jest.mock('@/modules/core/client/services/angular-compat', () => ({
  $on: jest.fn(() => () => {}),
}));

const build = {
  committedAt: '2026-06-21 18:06',
  commitUrl:
    'https://github.com/Trustroots/trustroots/commit/7a1d63965692fdb3361d3fd9ad1a6a17fb391b92',
  shortCommit: '7a1d639',
};

describe('<ReactFooter />', () => {
  it('renders the standard footer with build metadata', () => {
    render(<ReactFooter build={build} />);

    expect(
      screen.getByRole('link', {
        name: 'Currently deployed code: 2026-06-21 18:06 UTC (7a1d639)',
      }),
    ).toHaveAttribute('href', build.commitUrl);
  });

  it('renders the admin footer variant', () => {
    const { container } = render(<ReactFooter build={build} variant="admin" />);

    expect(container.querySelector('#tr-footer')).toHaveClass('container');
    expect(screen.getByRole('link', { name: 'Volunteering' })).toHaveAttribute(
      'href',
      'https://team.trustroots.org/',
    );
  });
});
