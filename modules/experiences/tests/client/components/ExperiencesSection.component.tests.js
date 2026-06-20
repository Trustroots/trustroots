import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import ExperiencesSection from '@/modules/experiences/client/components/read-experiences/ExperiencesSection';

const mockExperience = jest.fn(({ experience }) => (
  <div data-testid="experience-item">{experience._id}</div>
));

jest.mock(
  '@/modules/experiences/client/components/read-experiences/Experience',
  () => {
    return function ExperienceMock(props) {
      return mockExperience(props);
    };
  },
);

describe('<ExperiencesSection />', () => {
  const experiences = [
    {
      _id: 'experience-1',
      userTo: {
        displayName: 'Alice Example',
      },
    },
    {
      _id: 'experience-2',
      userTo: {
        displayName: 'Bob Example',
      },
    },
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
