import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import Faq from '@/modules/pages/client/components/Faq.component';
import type PageBoard from '@/modules/pages/client/components/PageBoard';

type BoardProps = React.ComponentProps<typeof PageBoard>;

jest.mock('@/modules/core/client/components/Board.js', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  function MockBoard({ children }: BoardProps) {
    return <div>{children}</div>;
  }

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

  it('renders circle and foundation category headings', () => {
    const { rerender } = render(
      <Faq category="tribes">
        <div>circle content</div>
      </Faq>,
    );

    expect(screen.getByText('about circles')).toBeInTheDocument();
    expect(screen.getByText('circle content')).toBeInTheDocument();

    rerender(
      <Faq category="foundation">
        <div>foundation content</div>
      </Faq>,
    );

    expect(screen.getByText('about the foundation')).toBeInTheDocument();
    expect(screen.getByText('foundation content')).toBeInTheDocument();
  });

  it('filters questions by answer text, reports no matches, and restores them', async () => {
    render(
      <Faq category="general">
        <div className="faq-question" id="first-question">
          <h3>First question</h3>
          An unusual answer about bicycles.
        </div>
        <div className="faq-question" id="second-question">
          <h3>Second question</h3>
          Another answer about trains.
        </div>
      </Faq>,
    );

    const filter = screen.getByRole('searchbox', {
      name: 'Search this category',
    });
    const firstQuestion = document.getElementById('first-question');
    const secondQuestion = document.getElementById('second-question');

    fireEvent.change(filter, { target: { value: 'BICYCLES' } });
    await waitFor(() => expect(secondQuestion).toHaveAttribute('hidden'));
    expect(firstQuestion).not.toHaveAttribute('hidden');

    fireEvent.change(filter, { target: { value: 'no such answer' } });
    expect(
      await screen.findByText(
        'No questions match your search in this category.',
      ),
    ).toBeVisible();
    expect(firstQuestion).toHaveAttribute('hidden');

    fireEvent.change(filter, { target: { value: '' } });
    await waitFor(() => expect(firstQuestion).not.toHaveAttribute('hidden'));
    expect(secondQuestion).not.toHaveAttribute('hidden');
    expect(
      screen.queryByText('No questions match your search in this category.'),
    ).not.toBeInTheDocument();
  });
});
