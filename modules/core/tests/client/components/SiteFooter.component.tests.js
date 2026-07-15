import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import SiteFooter from '@/modules/core/client/components/SiteFooter.component';

jest.mock('@/modules/core/client/services/angular-compat', () => ({
  $on: jest.fn(() => () => {}),
}));

const build = {
  committedAt: '2026-06-21 18:06',
  commitUrl:
    'https://github.com/Trustroots/trustroots/commit/7a1d63965692fdb3361d3fd9ad1a6a17fb391b92',
  shortCommit: '7a1d639',
};

describe('<SiteFooter />', () => {
  it('renders the standard footer with links and build metadata', () => {
    const { container } = render(<SiteFooter build={build} />);

    [
      ['Volunteering', '/volunteering'],
      ['Rules', '/rules'],
      ['FAQ', '/faq'],
      ['Wiki', 'https://wiki.trustroots.org/'],
      ['Privacy', '/privacy'],
      ['Contact', '/contact'],
    ].forEach(([name, href]) => {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    });
    expect(
      screen.queryByRole('link', { name: 'Contribute' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'Currently deployed code: 2026-06-21 18:06 UTC (7a1d639)',
      }),
    ).toHaveAttribute('href', build.commitUrl);
    expect(container.querySelector('.site-footer-build-icon')).toHaveClass(
      'icon-github',
    );
    expect(container.querySelector('.site-footer-links')).toHaveClass(
      'list-inline',
    );
    expect(container.querySelector('#tr-footer')).toHaveClass('hidden-xs');
  });

  it('shows non-main branch names with build metadata', () => {
    render(<SiteFooter build={{ ...build, branch: 'codex/footer-polish' }} />);

    expect(
      screen.getByRole('link', {
        name: 'Currently deployed code: codex/footer-polish; 2026-06-21 18:06 UTC (7a1d639)',
      }),
    ).toHaveAttribute('href', build.commitUrl);
    expect(screen.getByText('codex/footer-polish')).toBeInTheDocument();
  });

  it('does not show the branch name for main builds', () => {
    render(<SiteFooter build={{ ...build, branch: 'main' }} />);

    expect(screen.queryByText('main')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'Currently deployed code: 2026-06-21 18:06 UTC (7a1d639)',
      }),
    ).toHaveAttribute('href', build.commitUrl);
  });

  it('renders photo credits in the standard footer metadata', () => {
    render(
      <SiteFooter
        build={build}
        photoCredits={{
          road: { name: 'Alice', url: 'https://example.com/alice' },
        }}
      />,
    );

    expect(screen.getByText('Photo by')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute(
      'href',
      'https://example.com/alice',
    );
  });

  it('renders the admin footer with shared links, layout, and visible mobile markup', () => {
    const { container } = render(<SiteFooter variant="admin" build={build} />);
    const footer = container.querySelector('#tr-footer');

    expect(screen.getByRole('link', { name: 'Volunteering' })).toHaveAttribute(
      'href',
      '/volunteering',
    );
    expect(
      screen.queryByRole('link', { name: 'Trustroots Foundation' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'FAQ' })).toBeInTheDocument();
    expect(container.querySelector('.site-footer-content')).toBeInTheDocument();
    expect(container.querySelector('.site-footer-meta')).toBeInTheDocument();
    expect(footer).not.toHaveClass('tr-footer-admin');
    expect(footer).not.toHaveClass('hidden-xs');
  });

  it('renders the home footer with photo credits and build metadata', () => {
    render(
      <SiteFooter
        variant="home"
        build={build}
        photoCredits={{
          road: { name: 'Alice', url: 'https://example.com/alice' },
        }}
      />,
    );

    expect(screen.getByText('Photo by')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alice' })).toHaveAttribute(
      'href',
      'https://example.com/alice',
    );
    expect(
      screen.getByRole('link', {
        name: 'Currently deployed code: 2026-06-21 18:06 UTC (7a1d639)',
      }),
    ).toHaveAttribute('href', build.commitUrl);
  });

  it('omits build metadata when it is unavailable', () => {
    render(<SiteFooter />);

    expect(screen.queryByText(/UTC/)).not.toBeInTheDocument();
  });
});
