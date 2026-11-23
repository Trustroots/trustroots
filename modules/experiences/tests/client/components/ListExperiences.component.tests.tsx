import React from 'react';
import { render, screen } from '@testing-library/react';

import '@/config/client/i18n';
import ListExperiences from '@/modules/experiences/client/components/ListExperiences.component';
import { read as readExperiences } from '@/modules/experiences/client/api/experiences.api';
import type { Experience } from '@/modules/experiences/shared/experience';
import type ExperienceCounts from '@/modules/experiences/client/components/read-experiences/ExperienceCounts';
import type ExperiencesSection from '@/modules/experiences/client/components/read-experiences/ExperiencesSection';

vi.mock('@/modules/experiences/client/api/experiences.api');
const readExperiencesMock = vi.mocked(readExperiences);

vi.mock(
  '@/modules/experiences/client/components/read-experiences/ExperienceCounts',
  async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    function MockExperienceCounts({
      experiences,
    }: React.ComponentProps<typeof ExperienceCounts>) {
      return <div>{`public count: ${experiences.length}`}</div>;
    }
    return { default: MockExperienceCounts };
  },
);

vi.mock(
  '@/modules/experiences/client/components/read-experiences/ExperiencesSection',
  async () => {
    const React = await vi.importActual<typeof import('react')>('react');
    function MockExperiencesSection({
      experiences,
    }: React.ComponentProps<typeof ExperiencesSection>) {
      return (
        <div>{experiences.map(experience => experience._id).join(', ')}</div>
      );
    }
    return { default: MockExperiencesSection };
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
  vi.clearAllMocks();
});

describe('<ListExperiences />', () => {
  it('shows a no-content message and a share link when there are no experiences', async () => {
    readExperiencesMock.mockResolvedValueOnce([]);

    render(
      <ListExperiences
        profile={profile}
        authenticatedUser={authenticatedMember}
        experienceAction={{
          href: '/profile/member-one/experiences/new',
          label: 'Share your experience',
        }}
      />,
    );

    expect(await screen.findByText('No experiences yet.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Share your experience' }),
    ).toHaveAttribute('href', '/profile/member-one/experiences/new');
  });

  it('renders the normal public and pending sections for visitors', async () => {
    readExperiencesMock.mockResolvedValueOnce([
      makeExperience('e1', true),
      makeExperience('e2', false),
      makeExperience('e3', false),
    ]);

    render(
      <ListExperiences
        profile={profile}
        authenticatedUser={authenticatedMember}
      />,
    );

    expect(
      await screen.findByText('Experiences pending publishing'),
    ).toBeInTheDocument();
    expect(screen.getByText('public count: 1')).toBeInTheDocument();
    expect(screen.getByText('e1')).toBeInTheDocument();
    expect(screen.getByText('e3, e2')).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Experiences awaiting your reply' }),
    ).not.toBeInTheDocument();
  });

  it('groups unanswered Experiences for the owner and keeps all public Experiences in the count', async () => {
    const response = {
      _id: 'reply',
      created: '2024-01-02T00:00:00.000Z',
      interactions: { met: true, guest: false, host: false },
      recommend: 'yes',
    } as const;
    readExperiencesMock.mockResolvedValueOnce([
      makeExperience('public-unanswered', true),
      makeExperience('newer-pending', false),
      { ...makeExperience('public-answered', true), response },
      makeExperience('older-pending', false),
      { ...makeExperience('pending-answered', false), response },
    ]);

    render(<ListExperiences profile={profile} authenticatedUser={profile} />);

    const awaitingReply = await screen.findByRole('region', {
      name: 'Experiences awaiting your reply',
    });
    expect(awaitingReply).toHaveTextContent(
      'older-pending, newer-pending, public-unanswered',
    );
    expect(awaitingReply).not.toHaveTextContent('public-answered');
    expect(awaitingReply).not.toHaveTextContent('pending-answered');
    expect(screen.getByText('public count: 2')).toBeInTheDocument();
    expect(screen.getByText('public-answered')).toBeInTheDocument();
    expect(screen.getByText('pending-answered')).toBeInTheDocument();
  });

  it('labels the empty incoming list on the owner’s profile', async () => {
    readExperiencesMock.mockResolvedValueOnce([]);
    render(<ListExperiences profile={profile} authenticatedUser={profile} />);
    expect(
      await screen.findByText('No experiences received yet.'),
    ).toBeInTheDocument();
  });
});
