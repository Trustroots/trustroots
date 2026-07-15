import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Privacy from '@/modules/pages/client/components/Privacy.component';

jest.mock('@/modules/core/client/components/Board.js', () => {
  const React = require('react');

  function MockBoard({ children }) {
    return <div>{children}</div>;
  }

  MockBoard.propTypes = {
    children: () => null,
  };

  return MockBoard;
});

describe('<Privacy />', () => {
  it('renders privacy policy headings and key links', () => {
    render(<Privacy />);

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
    expect(
      screen.getByRole('link', { name: 'Zendesk privacy policy' }),
    ).toHaveAttribute(
      'href',
      'https://www.zendesk.com/company/customers-partners/privacy-policy/',
    );
    expect(screen.getByRole('link', { name: 'SparkPost' })).toHaveAttribute(
      'href',
      'https://www.sparkpost.com/',
    );
    expect(screen.queryByText(/Google Firebase/)).not.toBeInTheDocument();
  });
});
