import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import ExperienceCounts from '@/modules/experiences/client/components/read-experiences/ExperienceCounts';
import type {
  Experience,
  ExperienceInteractions,
  ExperienceUser,
} from '@/modules/experiences/shared/experience';

type ExperienceFixtureOverrides = Partial<
  Omit<Experience, 'userFrom' | 'userTo' | 'interactions'>
> & {
  userFrom?: Partial<ExperienceUser>;
  userTo?: Partial<ExperienceUser>;
  interactions?: Partial<ExperienceInteractions> | undefined;
};

let nextExperienceId = 0;

function experience(overrides: ExperienceFixtureOverrides = {}): Experience {
  const { interactions, userFrom, userTo, ...otherOverrides } = overrides;
  const fixtureInteractions = Object.prototype.hasOwnProperty.call(
    overrides,
    'interactions',
  )
    ? interactions && {
        met: false,
        guest: false,
        host: false,
        ...interactions,
      }
    : { met: false, guest: false, host: false };

  return {
    _id: otherOverrides._id || `experience-${++nextExperienceId}`,
    public: true,
    userFrom: {
      _id: 'user-from',
      username: 'member',
      gender: 'other',
      ...userFrom,
    },
    userTo: {
      _id: 'user-to',
      username: 'recipient',
      ...userTo,
    },
    created: '2026-06-05T12:00:00.000Z',
    interactions: fixtureInteractions,
    recommend: 'unknown',
    feedbackPublic: '',
    response: null,
    ...otherOverrides,
  };
}

describe('<ExperienceCounts />', () => {
  it('handles omitted private interaction fields', () => {
    render(
      <ExperienceCounts
        experiences={[experience({ interactions: undefined }), experience()]}
      />,
    );
    expect(screen.getByText('Did not meet with anyone.')).toBeInTheDocument();
  });

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

  it('shows all-guest interaction stats', () => {
    render(
      <ExperienceCounts
        experiences={[
          experience({
            _id: 'experience-1',
            interactions: { met: true, guest: true, host: false },
          }),
          experience({
            _id: 'experience-2',
            interactions: { met: true, guest: true, host: false },
          }),
          experience({
            _id: 'experience-3',
            interactions: { met: true, guest: true, host: false },
          }),
        ]}
      />,
    );

    expect(
      screen.getByText('They hosted everyone. Met with everyone.'),
    ).toBeInTheDocument();
  });

  it('shows partial met-only interaction stats', () => {
    render(
      <ExperienceCounts
        experiences={[
          experience({
            _id: 'experience-1',
            interactions: { met: true, guest: false, host: false },
          }),
          experience({
            _id: 'experience-2',
            interactions: { met: false, guest: false, host: false },
          }),
          experience({
            _id: 'experience-3',
            interactions: { met: false, guest: false, host: false },
          }),
        ]}
      />,
    );

    expect(screen.getByText('Met with 33% of members.')).toBeInTheDocument();
  });

  it('shows partial female-only and male-only gender stats', () => {
    const { rerender } = render(
      <ExperienceCounts
        experiences={[
          experience({
            _id: 'experience-1',
            userFrom: { gender: 'female' },
          }),
          experience({ _id: 'experience-2' }),
          experience({ _id: 'experience-3' }),
        ]}
      />,
    );

    expect(
      screen.getByText('33% of experiences are by female members.'),
    ).toBeInTheDocument();

    rerender(
      <ExperienceCounts
        experiences={[
          experience({
            _id: 'experience-1',
            userFrom: { gender: 'male' },
          }),
          experience({ _id: 'experience-2' }),
          experience({ _id: 'experience-3' }),
        ]}
      />,
    );

    expect(
      screen.getByText('33% of experiences are by male members.'),
    ).toBeInTheDocument();
  });
});
