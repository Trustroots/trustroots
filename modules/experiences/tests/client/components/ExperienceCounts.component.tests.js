import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ExperienceCounts from '@/modules/experiences/client/components/read-experiences/ExperienceCounts';

function experience(overrides = {}) {
  return {
    _id: overrides._id || Math.random().toString(),
    public: true,
    userFrom: {
      gender: 'other',
      ...(overrides.userFrom || {}),
    },
    userTo: {
      _id: 'user-to',
    },
    created: '2026-06-05T12:00:00.000Z',
    interactions: {
      met: false,
      guest: false,
      host: false,
      ...(overrides.interactions || {}),
    },
    recommend: 'unknown',
    feedbackPublic: '',
    ...overrides,
  };
}

describe('<ExperienceCounts />', () => {
  it('summarizes a single positive experience', () => {
    render(
      <ExperienceCounts experiences={[experience({ recommend: 'yes' })]} />,
    );

    expect(
      screen.getByText(
        'One member shared their experience and they recommended them.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Everyone recommends/)).not.toBeInTheDocument();
  });

  it('summarizes a single negative experience', () => {
    render(
      <ExperienceCounts experiences={[experience({ recommend: 'no' })]} />,
    );

    expect(
      screen.getByText(
        'One member shared their experience and they would not recommend them.',
      ),
    ).toBeInTheDocument();
  });

  it('shows all-positive recommendation, gender, and interaction stats', () => {
    render(
      <ExperienceCounts
        experiences={[
          experience({
            _id: 'experience-1',
            interactions: { met: true, guest: false, host: true },
            recommend: 'yes',
            userFrom: { gender: 'female' },
          }),
          experience({
            _id: 'experience-2',
            interactions: { met: true, guest: false, host: true },
            recommend: 'yes',
            userFrom: { gender: 'female' },
          }),
          experience({
            _id: 'experience-3',
            interactions: { met: true, guest: false, host: true },
            recommend: 'yes',
            userFrom: { gender: 'female' },
          }),
        ]}
      />,
    );

    expect(
      screen.getByText('3 members shared their experiences.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Everyone recommends them.')).toBeInTheDocument();
    expect(
      screen.getByText('All experiences are by female members.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Was hosted by everyone. Met with everyone.'),
    ).toBeInTheDocument();
  });

  it('shows all-negative recommendation and no-meeting stats', () => {
    render(
      <ExperienceCounts
        experiences={[
          experience({
            _id: 'experience-1',
            recommend: 'no',
            userFrom: { gender: 'male' },
          }),
          experience({
            _id: 'experience-2',
            recommend: 'no',
            userFrom: { gender: 'male' },
          }),
          experience({
            _id: 'experience-3',
            recommend: 'no',
            userFrom: { gender: 'male' },
          }),
        ]}
      />,
    );

    expect(
      screen.getByText('Everyone said they would not recommend them.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('All experiences are by male members.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Did not meet with anyone.')).toBeInTheDocument();
  });

  it('shows mixed recommendation, gender, host, guest, and met percentages', () => {
    render(
      <ExperienceCounts
        experiences={[
          experience({
            _id: 'experience-1',
            interactions: { met: true, guest: true, host: true },
            recommend: 'yes',
            userFrom: { gender: 'female' },
          }),
          experience({
            _id: 'experience-2',
            interactions: { met: true, guest: false, host: false },
            recommend: 'no',
            userFrom: { gender: 'male' },
          }),
          experience({
            _id: 'experience-3',
            interactions: { met: false, guest: false, host: false },
            recommend: 'unknown',
            userFrom: { gender: 'other' },
          }),
          experience({
            _id: 'experience-4',
            interactions: { met: false, guest: false, host: true },
            recommend: 'yes',
            userFrom: { gender: 'female' },
          }),
        ]}
      />,
    );

    expect(
      screen.getByText('1 did not recommend. 2 recommended them.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '50% of experiences are by females, and 25% are by males.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Was hosted by 50% of members. They hosted 25% of members. Met with 50% of members.',
      ),
    ).toBeInTheDocument();
  });
});
