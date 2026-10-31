import React, { type PropsWithChildren } from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import Privacy from '@/modules/pages/client/components/Privacy.component';

jest.mock('@/modules/core/client/components/Board.js', () => {
  const actualReact = jest.requireActual<typeof import('react')>('react');

  function MockBoard({ children }: PropsWithChildren) {
    return actualReact.createElement('div', null, children);
  }

  return MockBoard;
});

describe('<Privacy />', () => {
  it('shows dated policy summaries with GitHub links across the original and current pages', () => {
    render(<Privacy />);
    const history = screen.getByRole('region', { name: 'Revision history' });
    expect(
      within(history).getByRole('table', {
        name: 'Privacy policy revisions, newest first',
      }),
    ).toBeInTheDocument();
    expect(
      within(history).getByRole('link', { name: '2026-10-31' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/Trustroots/trustroots/commits/main/modules/pages/client/components/Privacy.component.tsx?since=2026-10-31&until=2026-11-01',
    );
    expect(
      screen.getByText(
        'We work to protect our community and members’ information as online risks evolve, including automated abuse and misuse of AI.',
      ),
    ).toBeInTheDocument();
    expect(
      within(history).getByRole('link', { name: '2026-10-21' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/Trustroots/trustroots/commit/db3d3090ddf5564243afb0e1462fe3d1affad371',
    );
    expect(
      within(history).getByText(
        'Added the requirement that members must be at least 18 years old.',
      ),
    ).toBeInTheDocument();
    expect(
      within(history).getByRole('link', { name: '2014-11-20' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/Trustroots/trustroots/commit/ab9d6109d22c8b68a53e9a121752090fb87eddb7',
    );
    expect(
      within(history).getByText(
        'Created the privacy page with Google Analytics information and tracking opt-out guidance.',
      ),
    ).toBeInTheDocument();
    expect(
      within(history).getByRole('link', { name: 'May 2020 to September 2026' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/Trustroots/trustroots/commits/main/modules/pages/client/components/Privacy.component.js',
    );
    expect(
      within(history).getByRole('link', { name: 'April 2015 to May 2020' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/Trustroots/trustroots/commits/main/modules/pages/client/views/privacy.client.view.html',
    );
  });

  it('renders privacy policy headings and key links', () => {
    render(<Privacy />);
    expect(
      screen.getByText('You must be 18 years old or older to use Trustroots.'),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: 'Privacy' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Trustroots Privacy Policy' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'First-party analytics' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Nostroots and Nostr' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'External services' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Nostroots privacy policy' }),
    ).toHaveAttribute('href', 'https://nos.trustroots.org/privacy/');
    for (const link of screen.getAllByRole('link', {
      name: 'Account settings',
    })) {
      expect(link).toHaveAttribute('href', '/profile/edit/account');
    }
    expect(
      screen.queryByRole('link', { name: 'Zendesk privacy policy' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /managed through Zendesk and stored on Zendesk servers/,
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Research' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'SparkPost' })).toHaveAttribute(
      'href',
      'https://www.sparkpost.com/',
    );
    expect(screen.queryByText(/Google Firebase/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /The most recent IP address used during authenticated activity/,
      ),
    ).toBeInTheDocument();
  });
});
