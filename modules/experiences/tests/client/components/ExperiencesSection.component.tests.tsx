import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ExperiencesSection from '@/modules/experiences/client/components/read-experiences/ExperiencesSection';
import type { Experience } from '@/modules/experiences/shared/experience';

type ExperienceItemProps = React.ComponentProps<
  typeof ExperiencesSection
>['experiences'][number];

const mockExperience = jest.fn(
  ({ experience }: { experience: ExperienceItemProps }) => (
    <div data-testid="experience-item">{experience._id}</div>
  ),
);

jest.mock(
  '@/modules/experiences/client/components/read-experiences/Experience',
  () => {
    return function ExperienceMock(props: {
      experience: ExperienceItemProps;
      onReceiverProfile: boolean;
    }) {
      return mockExperience(props);
    };
  },
);

const makeExperience = (id: string, displayName: string): Experience => ({
  _id: id,
  created: '2024-01-01T00:00:00.000Z',
  public: true,
  userFrom: {
    _id: 'member-from',
    username: 'member-from',
    displayName: 'Member From',
  },
  userTo: {
    _id: id,
    username: id,
    displayName,
  },
  interactions: { met: true, guest: false, host: false },
  recommend: 'yes',
  feedbackPublic: 'A kind experience.',
  response: null,
});

describe('<ExperiencesSection />', () => {
  const experiences = [
    makeExperience('experience-1', 'Member One'),
    makeExperience('experience-2', 'Member Two'),
  ];

  beforeEach(() => {
    mockExperience.mockClear();
  });

  it('renders one row per experience', () => {
    render(<ExperiencesSection experiences={experiences} onReceiverProfile />);

    expect(screen.getByText('experience-1')).toBeInTheDocument();
    expect(screen.getByText('experience-2')).toBeInTheDocument();
    expect(screen.getAllByTestId('experience-item')).toHaveLength(2);
  });

  it('passes onReceiverProfile through to each experience', () => {
    render(
      <ExperiencesSection
        experiences={experiences}
        onReceiverProfile={false}
      />,
    );

    expect(mockExperience).toHaveBeenCalledTimes(2);
    expect(mockExperience).toHaveBeenCalledWith(
      expect.objectContaining({
        experience: experiences[0],
        onReceiverProfile: false,
      }),
    );
  });

  it('handles empty experience lists without rendering items', () => {
    render(<ExperiencesSection experiences={[]} onReceiverProfile={true} />);

    expect(screen.queryByTestId('experience-item')).not.toBeInTheDocument();
  });

  it('passes onReceiverProfile true through to each experience', () => {
    render(
      <ExperiencesSection experiences={experiences} onReceiverProfile={true} />,
    );

    expect(mockExperience).toHaveBeenCalledWith(
      expect.objectContaining({
        experience: experiences[0],
        onReceiverProfile: true,
      }),
    );
  });
});
