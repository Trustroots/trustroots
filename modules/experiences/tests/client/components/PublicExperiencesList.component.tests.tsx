import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import '@/config/client/i18n';
import ExperiencesSection from '@/modules/experiences/client/components/read-experiences/ExperiencesSection';
import PublicExperiencesList from '@/modules/experiences/client/components/read-experiences/PublicExperiencesList';
import type { Experience } from '@/modules/experiences/shared/experience';

const profile = { _id: 'recipient', username: 'recipient' };
const experiences: Experience[] = [
  {
    _id: 'newer',
    userFrom: { _id: 'author-a', username: 'author-a' },
    userTo: profile,
    created: '2026-02-01T12:00:00.000Z',
    public: true,
    interactions: { met: true, guest: false, host: true },
    recommend: 'yes',
    feedbackPublic: 'We had dinner together.',
    response: null,
  },
  {
    _id: 'older',
    userFrom: { _id: 'author-b', username: 'author-b' },
    userTo: profile,
    created: '2026-01-01T12:00:00.000Z',
    public: true,
    feedbackPublic: 'We exchanged travel tips.',
    response: null,
  },
];

function renderPublicList() {
  return render(
    <PublicExperiencesList experiences={experiences}>
      {(filtered, tagFilters) => (
        <ExperiencesSection
          experiences={filtered}
          onReceiverProfile={false}
          tagFilters={tagFilters}
        />
      )}
    </PublicExperiencesList>,
  );
}

describe('<PublicExperiencesList />', () => {
  it('combines filters and includes missing recommendations in the unanswered category', () => {
    renderPublicList();
    const interaction = screen.getByRole('combobox', { name: 'Interaction' });
    const recommendation = screen.getByRole('combobox', {
      name: 'Recommendation',
    });

    fireEvent.change(interaction, { target: { value: 'host' } });
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1 of 2');
    expect(
      screen.queryByText('We exchanged travel tips.'),
    ).not.toBeInTheDocument();
    fireEvent.change(recommendation, { target: { value: 'unknown' } });
    expect(screen.getByRole('status')).toHaveTextContent(
      'No public experiences match these filters.',
    );
    fireEvent.change(interaction, { target: { value: '' } });
    expect(screen.getByText('We exchanged travel tips.')).toBeInTheDocument();
    expect(
      screen.queryByText('We had dinner together.'),
    ).not.toBeInTheDocument();
  });

  it('toggles both filters from tags and supports changing the chronological order', () => {
    renderPublicList();
    const reference = screen.getByText('We had dinner together.');
    const older = screen.getByText('We exchanged travel tips.');
    expect(reference.compareDocumentPosition(older)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    const byHost = screen.getByRole('button', { name: 'Filter by Host' });
    const byRecommendation = screen.getByRole('button', {
      name: 'Filter by Recommend',
    });
    fireEvent.click(byHost);
    fireEvent.click(byRecommendation);
    expect(byHost).toHaveAttribute('aria-pressed', 'true');
    expect(byRecommendation).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(byHost);
    fireEvent.click(byRecommendation);
    expect(byHost).toHaveAttribute('aria-pressed', 'false');
    expect(byRecommendation).toHaveAttribute('aria-pressed', 'false');
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by date' }), {
      target: { value: 'oldest' },
    });
    expect(
      reference.compareDocumentPosition(
        screen.getByText('We exchanged travel tips.'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_PRECEDING);
  });
});
