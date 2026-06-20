import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Feedback from '@/modules/experiences/client/components/create-experience/Feedback';

describe('<Feedback />', () => {
  function renderFeedback(props = {}) {
    return render(
      <Feedback
        feedback="Helpful host"
        recommend="yes"
        report={false}
        onChangeFeedback={() => {}}
        {...props}
      />,
    );
  }

  it('asks the positive recommendation prompt', () => {
    renderFeedback({ recommend: 'yes' });

    expect(
      screen.getByText('Did you enjoy their cooking? singing?'),
    ).toBeInTheDocument();
  });

  it('uses a softer negative prompt when this is not a report', () => {
    renderFeedback({ recommend: 'no', report: false });

    expect(
      screen.getByText('Did you not enjoy their cooking? singing?'),
    ).toBeInTheDocument();
  });

  it('uses the stronger negative prompt when this is a report', () => {
    renderFeedback({ recommend: 'no', report: true });

    expect(
      screen.getByText('Did you not like their cooking? singing?'),
    ).toBeInTheDocument();
  });

  it('asks the uncertain recommendation prompt', () => {
    renderFeedback({ recommend: 'unknown' });

    expect(
      screen.getByText('Did you maybe enjoy their cooking? singing?'),
    ).toBeInTheDocument();
  });

  it('renders no recommendation prompt for unexpected codes', () => {
    renderFeedback({ recommend: 'later' });

    expect(
      screen.queryByText(/Did you .* their cooking\? singing\?/),
    ).not.toBeInTheDocument();
  });

  it('calls onChangeFeedback with textarea values', () => {
    const onChangeFeedback = jest.fn();
    renderFeedback({ feedback: '', onChangeFeedback });

    fireEvent.change(screen.getByLabelText(/Leave your public feedback here/), {
      target: { value: 'Kind and welcoming' },
    });

    expect(onChangeFeedback).toHaveBeenCalledWith('Kind and welcoming');
  });
});
