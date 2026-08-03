import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Safety from '@/modules/pages/client/components/Safety.component';

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

describe('<Safety />', () => {
  it('renders practical safety guidance and key support links', () => {
    render(<Safety />);

    expect(
      screen.getByRole('heading', { name: 'Safety Tips for Trustroots' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Before You Meet' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Safety page contents' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Before You Meet' }),
    ).toHaveAttribute('href', '#before-you-meet');
    expect(
      screen.getByRole('link', { name: 'Community Safety' }),
    ).toHaveAttribute('href', '#community-safety');
    expect(screen.getByRole('link', { name: 'Emergencies' })).toHaveAttribute(
      'href',
      '#emergencies',
    );
    expect(
      screen.getByRole('link', { name: 'Help Us Build a Safer Community' }),
    ).toHaveAttribute('href', '#help-build-a-safer-community');
    expect(
      screen.getByRole('heading', { name: 'Emergencies' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Women Travellers and Gender Minorities',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/contact local emergency services first/i),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /contact|send us/i })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: expect.stringContaining('/support'),
        }),
      ]),
    );
    expect(
      screen.getByRole('link', {
        name: 'show accountability and make amends (Google Docs)',
      }),
    ).toHaveAttribute('target', '_blank');
  });
});
