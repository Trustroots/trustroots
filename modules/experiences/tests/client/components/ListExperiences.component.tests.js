import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import ListExperiences from '@/modules/experiences/client/components/ListExperiences.component';
import { read as readExperiences } from '@/modules/experiences/client/api/experiences.api';

jest.mock('@/modules/experiences/client/api/experiences.api');

jest.mock(
  '@/modules/experiences/client/components/read-experiences/ExperienceCounts',
  () => {
    const React = require('react');
    function MockExperienceCounts() {
      return <div>experience-counts</div>;
    }
    return MockExperienceCounts;
  },
);

jest.mock(
  '@/modules/experiences/client/components/read-experiences/ExperiencesSection',
  () => {
    const React = require('react');
    function MockExperiencesSection({ experiences }) {
      return <div>{`experiences-section-${experiences.length}`}</div>;
    }
    MockExperiencesSection.propTypes = { experiences: () => null };
    return MockExperiencesSection;
  },
);

afterEach(() => {
  jest.clearAllMocks();
});

describe('<ListExperiences />', () => {
  it('shows a no-content message and a share link when there are no experiences', async () => {
    readExperiences.mockResolvedValueOnce([]);

    render(
      <ListExperiences
        profile={{ _id: 'user-1', username: 'alice' }}
        authenticatedUser={{ _id: 'user-2' }}
      />,
    );

    expect(await screen.findByText('No experiences yet.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Share your experience' }),
    ).toHaveAttribute('href', '/profile/alice/experiences/new');
  });

  it('renders public and pending experience sections', async () => {
    readExperiences.mockResolvedValueOnce([
      { _id: 'e1', public: true },
      { _id: 'e2', public: false },
      { _id: 'e3', public: false },
    ]);

    render(
      <ListExperiences
        profile={{ _id: 'user-1', username: 'alice' }}
        authenticatedUser={{ _id: 'user-1' }}
      />,
    );

    expect(
      await screen.findByText('Experiences pending publishing'),
    ).toBeInTheDocument();
    expect(screen.getByText('experience-counts')).toBeInTheDocument();
    expect(screen.getByText('experiences-section-1')).toBeInTheDocument();
    expect(screen.getByText('experiences-section-2')).toBeInTheDocument();
  });
});
