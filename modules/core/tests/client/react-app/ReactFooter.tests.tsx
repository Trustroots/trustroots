import React from 'react';
import { render as rtlRender, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ReactFooter from '@/layers/shell/client/ReactFooter';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';

const analytics = fakeAnalytics();
const render = (
  ui: React.ReactElement,
  options?: Parameters<typeof rtlRender>[1],
) => rtlRender(ui, { wrapper: analytics.wrapper, ...options });

type BuildMetadata = NonNullable<
  React.ComponentProps<typeof ReactFooter>['build']
>;

jest.mock('@/modules/core/client/services/client-runtime', () => ({
  onClientEvent: jest.fn(() => () => {}),
}));

const build: BuildMetadata = {
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
      '/support?category=volunteering',
    );
  });
});
