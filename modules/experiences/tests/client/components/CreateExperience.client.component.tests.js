import React from 'react';
import {
  render,
  fireEvent,
  waitFor,
  waitForElementToBeRemoved,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import * as experiencesApi from '@/modules/experiences/client/api/experiences.api';
import * as supportApi from '@/modules/support/client/api/support.api';

import CreateExperience from '@/modules/experiences/client/components/CreateExperience.component';

jest.mock('@/modules/experiences/client/api/experiences.api');
jest.mock('@/modules/support/client/api/support.api');
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

  it('should not be possible to leave an experience to self', async () => {
    const me = { _id: '123456', username: 'username' };
    experiencesApi.readMine.mockResolvedValueOnce([]);
    const { queryByRole } = render(
      <CreateExperience userFrom={me} userTo={me} />,
    );
    expect(queryByRole('alert')).toHaveTextContent(
      "Sorry, you can't share experience only with yourself.",
    );
    await waitFor(() =>
      expect(experiencesApi.readMine).toHaveBeenCalledWith({
        userWith: me._id,
      }),
    );
  });

  it('check whether the experience exists at the beginning', async () => {
    experiencesApi.readMine.mockResolvedValueOnce([]);
    render(<CreateExperience userFrom={userFrom} userTo={userTo} />);
    await waitFor(() =>
      expect(experiencesApi.readMine).toHaveBeenCalledWith({
        userWith: userTo._id,
      }),
    );
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
    expect(experiencesApi.readMine).toHaveBeenCalledWith({
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
    expect(experiencesApi.readMine).toHaveBeenCalledWith({
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
    fireEvent.change(getByLabelText(/Leave your public feedback here/), {
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

    const successMessage = await waitFor(() =>
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

    await waitFor(() =>
      expect(supportApi.reportMember).toHaveBeenCalledWith(
        userTo,
        'they were mean to me',
      ),
    );

    const successMessage = await waitFor(() =>
      getByText('Thank you for sharing your experience!').closest('div'),
    );
    expect(successMessage).toHaveTextContent(
      `Your experience will become public when ${userTo.displayName} shares their experience, or at most in 14 days.`,
    );
    expect(successMessage).toHaveTextContent(`You also reported them to us.`);
  });

  it('can navigate back after choosing that members met in person', async () => {
    experiencesApi.readMine.mockResolvedValueOnce(null);

    const { getAllByText, getByLabelText, queryByLabelText } = render(
      <CreateExperience userFrom={userFrom} userTo={userTo} />,
    );

    await waitForLoader();

    fireEvent.click(getByLabelText('Met in person'));
    fireEvent.click(getAllByText('Next')[0]);

    expect(
      queryByLabelText(
        'Besides your personal experience, would you recommend others to meet them?',
      ),
    ).toBeInTheDocument();

    fireEvent.click(getAllByText('Back')[0]);

    expect(getByLabelText('Met in person')).toBeInTheDocument();
  });

  it('uses hosting as the primary recommendation prompt', async () => {
    experiencesApi.readMine.mockResolvedValueOnce(null);

    const { getAllByText, getByLabelText, queryByLabelText } = render(
      <CreateExperience userFrom={userFrom} userTo={userTo} />,
    );

    await waitForLoader();

    fireEvent.click(getByLabelText('I hosted them'));
    fireEvent.click(getAllByText('Next')[0]);

    expect(
      queryByLabelText(
        'Besides your personal experience, would you recommend others to host them?',
      ),
    ).toBeInTheDocument();
  });

  it('skips recommendation when the other member already shared publicly', async () => {
    experiencesApi.readMine.mockResolvedValueOnce({
      userFrom: userTo._id,
      public: true,
      response: null,
    });
    experiencesApi.create.mockResolvedValueOnce({ public: true });

    const { getAllByText, getByLabelText, queryByLabelText, findByText } =
      render(<CreateExperience userFrom={userFrom} userTo={userTo} />);

    await waitForLoader();

    fireEvent.click(getByLabelText('Met in person'));
    fireEvent.click(getAllByText('Next')[0]);

    expect(
      queryByLabelText(
        'Besides your personal experience, would you recommend others to meet them?',
      ),
    ).not.toBeInTheDocument();
    expect(
      queryByLabelText(
        'Would you like to describe something about your experience with them? (Optional)',
      ),
    ).toBeInTheDocument();

    fireEvent.click(getAllByText('Finish')[0]);

    expect(experiencesApi.create).toHaveBeenCalledWith({
      interactions: { met: true, host: false, guest: false },
      recommend: 'yes',
      feedbackPublic: '',
      userTo: userTo._id,
    });
    expect(
      await findByText('Thank you for sharing your experience!'),
    ).toBeInTheDocument();
  });

  it('lets members retry when the initial experience lookup fails', async () => {
    experiencesApi.readMine
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockResolvedValueOnce(null);
    render(<CreateExperience userFrom={userFrom} userTo={userTo} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load the experience form. Please try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByLabelText('Met in person')).toBeInTheDocument();
    expect(experiencesApi.readMine).toHaveBeenCalledTimes(2);
  });

  async function fillExperience({ report = false } = {}) {
    experiencesApi.readMine.mockResolvedValueOnce(null);
    render(<CreateExperience userFrom={userFrom} userTo={userTo} />);
    await waitForLoader();
    fireEvent.click(screen.getByLabelText('Met in person'));
    fireEvent.click(screen.getAllByText('Next')[0]);
    fireEvent.click(screen.getByText(report ? 'No' : 'Yes'));
    if (report) {
      fireEvent.click(
        screen.getByText('Privately report this person to the moderators'),
      );
      fireEvent.change(screen.getByLabelText('Message to the moderators'), {
        target: { value: 'A fictional private report.' },
      });
    }
    fireEvent.click(screen.getAllByText('Next')[0]);
    fireEvent.change(screen.getByLabelText(/Leave your public feedback here/), {
      target: { value: 'A fictional public experience.' },
    });
  }

  it.each([
    [
      new Error('Network failure'),
      'We could not save your experience. Your text is still here. Please try again.',
    ],
    [
      { response: { data: { details: { feedbackPublic: 'toolong' } } } },
      'Your feedback is too long. Please shorten it and try again.',
    ],
  ])(
    'preserves the draft and enables retry after a failed save (%j)',
    async (error, message) => {
      experiencesApi.create
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ public: false });
      await fillExperience();

      fireEvent.click(screen.getAllByText('Finish')[0]);
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(
        screen.getByLabelText(/Leave your public feedback here/),
      ).toHaveValue('A fictional public experience.');
      expect(screen.getAllByText('Finish')[0]).toBeEnabled();
      expect(
        screen.queryByText('Thank you for sharing your experience!'),
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getAllByText('Finish')[0]);
      expect(
        await screen.findByText('Thank you for sharing your experience!'),
      ).toBeInTheDocument();
      expect(experiencesApi.create).toHaveBeenCalledTimes(2);
      expect(experiencesApi.create.mock.calls[1]).toEqual(
        experiencesApi.create.mock.calls[0],
      );
      expect(screen.queryByText(message)).not.toBeInTheDocument();
    },
  );

  it('recognises a saved experience after a lost response causes a retry conflict', async () => {
    await fillExperience();
    experiencesApi.create.mockRejectedValueOnce({ response: { status: 409 } });
    experiencesApi.readMine.mockResolvedValueOnce({
      userFrom: userFrom._id,
      public: true,
    });
    fireEvent.click(screen.getAllByText('Finish')[0]);
    expect(
      await screen.findByText('Thank you for sharing your experience!'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Your experience with ${userTo.displayName} is public now.`,
      ),
    ).toBeInTheDocument();
  });

  it.each([null, { userFrom: 'another-member', public: true }])(
    'does not claim success for an unconfirmed conflict (%j)',
    async existing => {
      await fillExperience();
      experiencesApi.create.mockRejectedValueOnce({
        response: { status: 409 },
      });
      experiencesApi.readMine.mockResolvedValueOnce(existing);
      fireEvent.click(screen.getAllByText('Finish')[0]);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'We could not save your experience.',
      );
      expect(screen.getAllByText('Finish')[0]).toBeEnabled();
    },
  );

  it('keeps the draft available when checking a retry conflict also fails', async () => {
    await fillExperience();
    experiencesApi.create.mockRejectedValueOnce({ response: { status: 409 } });
    experiencesApi.readMine.mockRejectedValueOnce(
      new Error('Connection failed'),
    );
    fireEvent.click(screen.getAllByText('Finish')[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not save your experience.',
    );
    expect(screen.getAllByText('Finish')[0]).toBeEnabled();
  });

  it('does not send a private report when saving the experience fails', async () => {
    experiencesApi.create.mockRejectedValueOnce(new Error('Connection failed'));
    await fillExperience({ report: true });
    fireEvent.click(screen.getAllByText('Finish')[0]);
    await screen.findByRole('alert');
    expect(supportApi.reportMember).not.toHaveBeenCalled();
  });

  it('can retry a failed private report without saving the experience again', async () => {
    experiencesApi.create.mockResolvedValueOnce({ public: false });
    supportApi.reportMember
      .mockRejectedValueOnce(new Error('Connection failed'))
      .mockRejectedValueOnce(new Error('Connection failed again'))
      .mockResolvedValueOnce();
    await fillExperience({ report: true });
    fireEvent.click(screen.getAllByText('Finish')[0]);

    expect(
      await screen.findByText('Thank you for sharing your experience!'),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your experience was saved, but your private report could not be sent.',
    );
    expect(
      screen.queryByText(/You also reported them to us/),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry private report' }),
    );
    await waitFor(() =>
      expect(supportApi.reportMember).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Retry private report' }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry private report' }),
    );

    expect(
      await screen.findByText(/You also reported them to us/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Your experience was saved, but/),
    ).not.toBeInTheDocument();
    expect(experiencesApi.create).toHaveBeenCalledTimes(1);
    expect(supportApi.reportMember).toHaveBeenCalledTimes(3);
    expect(supportApi.reportMember).toHaveBeenLastCalledWith(
      userTo,
      'A fictional private report.',
    );
  });
});
