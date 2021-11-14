import React from 'react';
import {
  screen,
  render,
  fireEvent,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import * as experiencesApi from '@/modules/experiences/client/api/experiences.api';

import CreateExperience from '@/modules/experiences/client/components/CreateExperience.component';

jest.mock('@/modules/experiences/client/api/experiences.api');
afterEach(() => jest.clearAllMocks());

async function waitForLoader() {
  await waitForElementToBeRemoved(screen.queryByText('Wait a moment…'));
}

describe('<CreateExperience />', () => {
  let userFrom;
  let userTo;

  beforeEach(() => {
    userFrom = {
      _id: '111111',
      displayName: 'from-name',
      username: 'userfrom',
    };
    userTo = { _id: '222222', displayName: 'to-name', username: 'userto' };
  });

  it('should not be possible to leave an experience to self', () => {
    const me = { _id: '123456', username: 'username' };
    experiencesApi.readMine.mockResolvedValueOnce([]);
    render(<CreateExperience userFrom={me} userTo={me} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Sorry, you can't share experience only with yourself.",
    );
  });

  it('check whether the experience exists at the beginning', () => {
    experiencesApi.readMine.mockResolvedValueOnce([]);
    render(<CreateExperience userFrom={userFrom} userTo={userTo} />);
    expect(experiencesApi.readMine).toBeCalledWith({
      userWith: userTo._id,
    });
  });

  it('can not leave a second experience - without response', async () => {
    experiencesApi.readMine.mockResolvedValueOnce({
      userFrom: userFrom._id,
      public: false,
      response: null,
    });
    render(<CreateExperience userFrom={userFrom} userTo={userTo} />);
    await waitForLoader();
    expect(screen.getByRole('heading')).toHaveTextContent(
      `You already shared your experience with them`,
    );
    expect(experiencesApi.readMine).toBeCalledWith({
      userWith: userTo._id,
    });
  });

  it('can not leave a second experience - with response', async () => {
    experiencesApi.readMine.mockResolvedValueOnce({
      userFrom: userTo._id,
      public: true,
      response: 'mocked response',
    });
    render(<CreateExperience userFrom={userFrom} userTo={userTo} />);
    await waitForLoader();
    expect(screen.getByRole('heading')).toHaveTextContent(
      `You already shared your experience with them`,
    );
    expect(experiencesApi.readMine).toBeCalledWith({
      userWith: userTo._id,
    });
  });

  it('can leave an experience (experience form is available)', async () => {
    experiencesApi.readMine.mockResolvedValueOnce(null);
    render(<CreateExperience userFrom={userFrom} userTo={userTo} />);
    await waitForLoader();
    for (const label of ['Met in person', 'I hosted them', 'They hosted me']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('submit an experience', async () => {
    experiencesApi.readMine.mockResolvedValueOnce(null);
    experiencesApi.create.mockResolvedValueOnce({ public: false });

    render(<CreateExperience userFrom={userFrom} userTo={userTo} />);

    await waitForLoader();

    expect(screen.getAllByText('How do you know them?')[1]).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('They hosted me'));

    fireEvent.click(screen.getAllByText('Next')[0]);

    expect(
      screen.getByLabelText(
        'Besides your personal experience, would you recommend others to stay with them?',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Yes'));

    fireEvent.click(screen.getAllByText('Next')[0]);

    expect(
      screen.getByLabelText(
        'Would you like to describe something about your experience with them? (Optional)',
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Public feedback'), {
      target: { value: 'they made a tasty pie' },
    });

    fireEvent.click(screen.getAllByText('Finish')[0]);

    expect(experiencesApi.create).toHaveBeenCalledWith({
      interactions: {
        met: false,
        guest: true,
        host: false,
      },
      recommend: 'yes',
      feedbackPublic: 'they made a tasty pie',
      userTo: userTo._id,
    });

    // Success message
    expect(
      screen.getByText(
        `Your experience will become public when ${userTo.displayName} shares their experience, or at most in 14 days.`,
      ),
    ).toBeInTheDocument();

    // Didn't report, no confirmation
    expect(
      screen.queryByText(`You also reported them to us.`),
    ).not.toBeInTheDocument();
  });

  it('submit a report when recommend is no and user wants to send a report', async () => {
    experiencesApi.readMine.mockResolvedValueOnce(null);
    experiencesApi.create.mockResolvedValueOnce({ public: false });

    render(<CreateExperience userFrom={userFrom} userTo={userTo} />);

    await waitForLoader();

    expect(screen.getAllByText('How do you know them?')[1]).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('They hosted me'));

    fireEvent.click(screen.getAllByText('Next')[0]);

    expect(
      screen.getByLabelText(
        'Besides your personal experience, would you recommend others to stay with them?',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('No'));

    fireEvent.click(
      screen.getByText('Privately report this person to the moderators'),
    );
    fireEvent.change(screen.getByLabelText('Message to the moderators'), {
      target: { value: 'they were mean to me' },
    });

    fireEvent.click(screen.getAllByText('Next')[0]);

    fireEvent.click(screen.getAllByText('Finish')[0]);

    expect(experiencesApi.create).toHaveBeenCalledWith({
      interactions: {
        met: false,
        guest: true,
        host: false,
      },
      recommend: 'no',
      feedbackPublic: '',
      userTo: userTo._id,
    });

    expect(experiencesApi.report).toHaveBeenCalledWith(
      userTo,
      'they were mean to me',
    );

    // Success message
    expect(
      screen.getByText(
        `Your experience will become public when ${userTo.displayName} shares their experience, or at most in 14 days.`,
      ),
    ).toBeInTheDocument();

    // Reported confirmation
    expect(
      screen.getByText(`You also reported them to us.`),
    ).toBeInTheDocument();
  });
});
