import React from 'react';
import { render as rtlRender, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import NotFoundPage from '@/modules/core/client/components/NotFoundPage.component';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';

const analytics = fakeAnalytics();
const render = (
  ui: React.ReactElement,
  options?: Parameters<typeof rtlRender>[1],
) => rtlRender(ui, { wrapper: analytics.wrapper, ...options });

describe('<NotFoundPage />', () => {
  beforeEach(() => analytics.track.mockClear());

  it('renders fallback copy and actions for missing pages', () => {
    render(<NotFoundPage />);

    expect(
      screen.getByRole('heading', { name: 'This page cannot be found.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue…' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('link', { name: 'Contact us' })).toHaveAttribute(
      'href',
      '/support',
    );
    expect(analytics.track).toHaveBeenCalledTimes(1);
    expect(analytics.track).toHaveBeenCalledWith('page_not_found');
  });
});
