import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import FaqBugsAndFeatures from '@/modules/pages/client/components/FaqBugsAndFeatures.component';
import FaqFoundation from '@/modules/pages/client/components/FaqFoundation.component';
import FaqGeneral from '@/modules/pages/client/components/FaqGeneral.component';
import FaqTechnology from '@/modules/pages/client/components/FaqTechnology.component';
import FaqTribes from '@/modules/pages/client/components/FaqTribes.component';

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

describe('FAQ page sections', () => {
  it('renders general FAQ questions and sidebar context', () => {
    render(<FaqGeneral />);

    expect(
      screen.getByRole('heading', {
        name: 'Is Trustroots exclusively for hitchhikers?',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(content =>
        content.includes('No. Trustroots is for everyone.'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'What is your long term vision?' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Read more' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Nostroots mobile app' }),
    ).toHaveAttribute('href', 'https://nos.trustroots.org/');
    expect(screen.getByRole('link', { name: 'Nostroots' })).toHaveAttribute(
      'href',
      'https://nos.trustroots.org/',
    );
    expect(screen.getByText(/not a traditional forum/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Twitter' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Facebook' }),
    ).not.toBeInTheDocument();
  });

  it('renders foundation FAQ text', () => {
    render(<FaqFoundation />);

    expect(
      screen.getByRole('heading', {
        name: "What's your legal status?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        content =>
          content.includes('owned and operated by') &&
          content.includes('Limited by Guarantee') &&
          content.includes('section 60 exemption'),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'team.trustroots.org' }),
    ).toHaveAttribute('href', 'https://team.trustroots.org/');
  });

  it('renders tribes FAQ text', () => {
    render(<FaqTribes />);

    expect(
      screen.getByRole('heading', { name: 'What are circles?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        content =>
          content.includes('You can start now by joining') &&
          content.includes('that you identify yourself with.'),
      ),
    ).toBeInTheDocument();
  });

  it('renders technology FAQ text', () => {
    render(<FaqTechnology />);

    expect(
      screen.getByRole('heading', { name: 'Is Trustroots open source?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/active development again/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nostroots' })).toHaveAttribute(
      'href',
      'https://nos.trustroots.org/',
    );
    expect(
      screen.getByRole('link', { name: 'Nostroots repository' }),
    ).toHaveAttribute('href', 'https://github.com/Trustroots/nostroots');
  });

  it('renders bugs-and-features FAQ text', () => {
    render(<FaqBugsAndFeatures />);

    expect(
      screen.getByRole('heading', { name: 'How do I report a bug?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/search bar/i)).toBeInTheDocument();
    expect(screen.getByText(/active development again/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nostroots' })).toHaveAttribute(
      'href',
      'https://nos.trustroots.org/',
    );
  });
});
