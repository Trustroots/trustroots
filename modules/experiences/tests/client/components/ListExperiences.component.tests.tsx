import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import ListExperiences from '@/modules/experiences/client/components/ListExperiences.component';
import { read as readExperiences } from '@/modules/experiences/client/api/experiences.api';
import type { Experience } from '@/modules/experiences/shared/experience';
import type ExperiencesSection from '@/modules/experiences/client/components/read-experiences/ExperiencesSection';

jest.mock('@/modules/experiences/client/api/experiences.api');
const readExperiencesMock = jest.mocked(readExperiences);

jest.mock(
  '@/modules/experiences/client/components/read-experiences/ExperienceCounts',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');
    function MockExperienceCounts() {
      return <div>experience-counts</div>;
    }
    return MockExperienceCounts;
  },
);

jest.mock(
  '@/modules/experiences/client/components/read-experiences/ExperiencesSection',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');
    function MockExperiencesSection({
      experiences,
    }: React.ComponentProps<typeof ExperiencesSection>) {
      return <div>{`experiences-section-${experiences.length}`}</div>;
    }
    return MockExperiencesSection;
  },
);

type ExperienceUser = React.ComponentProps<typeof ListExperiences>['profile'];
const profile: ExperienceUser = { _id: 'user-1', username: 'member-one' };
const authenticatedMember: ExperienceUser = {
  _id: 'user-2',
  username: 'member-two',
};
const makeExperience = (id: string, isPublic: boolean): Experience => ({
  _id: id,
  created: '2024-01-01T00:00:00.000Z',
  public: isPublic,
  userFrom: { _id: 'user-2', username: 'member-two' },
  userTo: { _id: 'user-1', username: 'member-one' },
  interactions: { met: true, guest: false, host: false },
  recommend: 'yes',
  feedbackPublic: 'A kind experience.',
  response: null,
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('<ListExperiences />', () => {
  it('shows a no-content message and a share link when there are no experiences', async () => {
    readExperiencesMock.mockResolvedValueOnce([]);

    render(
      <ListExperiences
        profile={profile}
        authenticatedUser={authenticatedMember}
      />,
    );

    expect(await screen.findByText('No experiences yet.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Share your experience' }),
    ).toHaveAttribute('href', '/profile/member-one/experiences/new');
  });

  it('renders public and pending experience sections', async () => {
    readExperiencesMock.mockResolvedValueOnce([
      makeExperience('e1', true),
      makeExperience('e2', false),
      makeExperience('e3', false),
    ]);

    render(
      <ListExperiences profile={profile} authenticatedUser={{ ...profile }} />,
    );

    expect(
      await screen.findByText('Experiences pending publishing'),
    ).toBeInTheDocument();
    expect(screen.getByText('experience-counts')).toBeInTheDocument();
    expect(screen.getByText('experiences-section-1')).toBeInTheDocument();
    expect(screen.getByText('experiences-section-2')).toBeInTheDocument();
  });
});
