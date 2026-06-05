import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Faq from '@/modules/pages/client/components/Faq.component';

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

describe('<Faq />', () => {
  it('renders category-specific header copy for general', () => {
    render(
      <Faq category="general">
        <div>custom content</div>
      </Faq>,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Frequently Asked Questions',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('about the site & community')).toBeInTheDocument();
    expect(screen.getByText('custom content')).toBeInTheDocument();
  });

  it('renders category-specific header copy for bugs-and-features', () => {
    render(
      <Faq category="bugs-and-features">
        <div>custom bugs-and-features content</div>
      </Faq>,
    );

    expect(screen.getByText('about Bugs & Features')).toBeInTheDocument();
    expect(
      screen.getByText('custom bugs-and-features content'),
    ).toBeInTheDocument();
  });

  it('renders technology heading when category is technology', () => {
    render(
      <Faq category="technology">
        <div>technology content</div>
      </Faq>,
    );

    expect(screen.getByText('about technology')).toBeInTheDocument();
    expect(screen.getByText('technology content')).toBeInTheDocument();
  });
});
