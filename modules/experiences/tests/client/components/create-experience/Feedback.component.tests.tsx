import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import '@/config/client/i18n';
import Feedback from '@/modules/experiences/client/components/create-experience/Feedback';

type FeedbackProps = React.ComponentProps<typeof Feedback>;

describe('<Feedback />', () => {
  function renderFeedback(props: Partial<FeedbackProps> = {}) {
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

  it('asks members to describe the impact of an experience they would not recommend', () => {
    renderFeedback({ recommend: 'no', report: false });

    expect(
      screen.getByText('Describe what happened and how it affected you.'),
    ).toBeInTheDocument();
  });

  it('asks members to keep sensitive details in a private report', () => {
    renderFeedback({ recommend: 'no', report: true });

    expect(
      screen.getByText(
        'Describe what happened and keep sensitive details in your private report.',
      ),
    ).toBeInTheDocument();
  });

  it('asks the uncertain recommendation prompt', () => {
    renderFeedback({ recommend: 'unknown' });

    expect(
      screen.getByText('Did you maybe enjoy their cooking? singing?'),
    ).toBeInTheDocument();
  });

  it('renders no recommendation prompt for unexpected codes', () => {
    // The component intentionally renders safely for values outside its union.
    renderFeedback({ recommend: 'later' as never });

    expect(
      screen.queryByText(/Did you .* their cooking\? singing\?/),
    ).not.toBeInTheDocument();
  });

  it('calls onChangeFeedback with textarea values', () => {
    const onChangeFeedback = vi.fn();
    renderFeedback({ feedback: '', onChangeFeedback });

    fireEvent.change(screen.getByLabelText(/Leave your public feedback here/), {
      target: { value: 'Kind and welcoming' },
    });

    expect(onChangeFeedback).toHaveBeenCalledWith('Kind and welcoming');
  });
});
