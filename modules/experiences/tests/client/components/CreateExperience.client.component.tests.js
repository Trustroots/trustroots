import React from 'react';
import {
  render,
  fireEvent,
  waitForElement,
  waitForElementToBeRemoved,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import * as experiencesApi from '@/modules/experiences/client/api/experiences.api';

import CreateExperience from '@/modules/experiences/client/components/CreateExperience.component';

jest.mock('@/modules/experiences/client/api/experiences.api');
afterEach(() => jest.clearAllMocks());

async function waitForLoader() {
  await waitForElementToBeRemoved(() => screen.getByText('Wait a moment…'));
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
    const { queryByRole } = render(
      <CreateExperience userFrom={me} userTo={me} />,
    );
    expect(queryByRole('alert')).toHaveTextContent(
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
    const { queryByRole } = render(
      <CreateExperience userFrom={userFrom} userTo={userTo} />,
    );
    await waitForLoader();
    expect(queryByRole('heading')).toHaveTextContent(
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
    const { queryByRole } = render(
      <CreateExperience userFrom={userFrom} userTo={userTo} />,
    );
    await waitForLoader();
    expect(queryByRole('heading')).toHaveTextContent(
      `You already shared your experience with them`,
    );
    expect(experiencesApi.readMine).toBeCalledWith({
      userWith: userTo._id,
    });
  });

  it('can leave an experience (experience form is available)', async () => {
    experiencesApi.readMine.mockResolvedValueOnce(null);
    const { queryByLabelText } = render(
      <CreateExperience userFrom={userFrom} userTo={userTo} />,
    );
    await waitForLoader();
    for (const label of ['Met in person', 'I hosted them', 'They hosted me']) {
      expect(queryByLabelText(label)).toBeInTheDocument();
    }
  });

  it('submit an experience', async () => {
    experiencesApi.readMine.mockResolvedValueOnce(null);
    experiencesApi.create.mockResolvedValueOnce({ public: false });

    const { getByText, getAllByText, getByLabelText, queryByLabelText } =
      render(<CreateExperience userFrom={userFrom} userTo={userTo} />);

    await waitForLoader();

    expect(getAllByText('How do you know them?')[1]).toBeInTheDocument();
    fireEvent.click(getByLabelText('They hosted me'));

    fireEvent.click(getAllByText('Next')[0]);

    expect(
      queryByLabelText(
        'Besides your personal experience, would you recommend others to stay with them?',
      ),
    ).toBeInTheDocument();
    fireEvent.click(getByText('Yes'));

    fireEvent.click(getAllByText('Next')[0]);

    expect(
      queryByLabelText(
        'Would you like to describe something about your experience with them? (Optional)',
      ),
    ).toBeInTheDocument();
    fireEvent.change(getByLabelText('Public feedback'), {
      target: { value: 'they made a tasty pie' },
    });

    fireEvent.click(getAllByText('Finish')[0]);

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

    const successMessage = await waitForElement(() =>
      getByText('Thank you for sharing your experience!').closest('div'),
    );
    expect(successMessage).toHaveTextContent(
      `Your experience will become public when ${userTo.displayName} shares their experience, or at most in 14 days.`,
    );
    expect(successMessage).not.toHaveTextContent(
      `You also reported them to us.`,
    );
  });

  it('submit a report when recommend is no and user wants to send a report', async () => {
    experiencesApi.readMine.mockResolvedValueOnce(null);
    experiencesApi.create.mockResolvedValueOnce({ public: false });

    const { getByText, getAllByText, getByLabelText, queryByLabelText } =
      render(<CreateExperience userFrom={userFrom} userTo={userTo} />);

    await waitForLoader();

    expect(getAllByText('How do you know them?')[1]).toBeInTheDocument();
    fireEvent.click(getByLabelText('They hosted me'));

    fireEvent.click(getAllByText('Next')[0]);

    expect(
      queryByLabelText(
        'Besides your personal experience, would you recommend others to stay with them?',
      ),
    ).toBeInTheDocument();
    fireEvent.click(getByText('No'));

    fireEvent.click(
      getByText('Privately report this person to the moderators'),
    );
    fireEvent.change(getByLabelText('Message to the moderators'), {
      target: { value: 'they were mean to me' },
    });

    fireEvent.click(getAllByText('Next')[0]);

    fireEvent.click(getAllByText('Finish')[0]);

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

    const successMessage = await waitForElement(() =>
      getByText('Thank you for sharing your experience!').closest('div'),
    );
    expect(successMessage).toHaveTextContent(
      `Your experience will become public when ${userTo.displayName} shares their experience, or at most in 14 days.`,
    );
    expect(successMessage).toHaveTextContent(`You also reported them to us.`);
  });
});
