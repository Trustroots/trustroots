import React from 'react';
import {
  render,
  fireEvent,
  waitForElement,
  waitForElementToBeRemoved,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import * as references from '@/modules/references/client/api/references.api';

import CreateReference from '@/modules/references/client/components/CreateReference.component';
const api = { references };

jest.mock('@/modules/references/client/api/references.api');
afterEach(() => jest.clearAllMocks());

async function waitForLoader() {
  await waitForElementToBeRemoved(() => screen.getByText('Wait a moment…'));
}

describe('<CreateReference />', () => {
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

  it('should not be possible to leave a reference to self', () => {
    const me = { _id: '123456', username: 'username' };
    api.references.readMine.mockResolvedValueOnce([]);
    const { queryByRole } = render(
      <CreateReference userFrom={me} userTo={me} />,
    );
    expect(queryByRole('alert')).toHaveTextContent(
      "Sorry, you can't share experience only with yourself.",
    );
  });

  it('check whether the reference exists at the beginning', () => {
    api.references.readMine.mockResolvedValueOnce([]);
    render(<CreateReference userFrom={userFrom} userTo={userTo} />);
    expect(api.references.readMine).toBeCalledWith({
      userTo: userTo._id,
    });
  });

  it('can not leave a second reference', async () => {
    api.references.readMine.mockResolvedValueOnce([{ userTo, public: false }]);
    const { queryByRole } = render(
      <CreateReference userFrom={userFrom} userTo={userTo} />,
    );
    await waitForLoader();
    expect(queryByRole('heading')).toHaveTextContent(
      `You already shared your experience with them`,
    );
    expect(api.references.readMine).toBeCalledWith({
      userTo: userTo._id,
    });
  });

  it('can leave a reference (reference form is available)', async () => {
    api.references.readMine.mockResolvedValueOnce(null);
    const { queryByLabelText } = render(
      <CreateReference userFrom={userFrom} userTo={userTo} />,
    );
    await waitForLoader();
    for (const label of ['Met in person', 'I hosted them', 'They hosted me']) {
      expect(queryByLabelText(label)).toBeInTheDocument();
    }
  });

  it('submit a reference', async () => {
    api.references.readMine.mockResolvedValueOnce(null);
    api.references.create.mockResolvedValueOnce({ public: false });

    const {
      getByText,
      getAllByText,
      getByLabelText,
      queryByLabelText,
    } = render(<CreateReference userFrom={userFrom} userTo={userTo} />);

    await waitForLoader();

    expect(queryByLabelText('How do you know them?')).toBeInTheDocument();
    fireEvent.click(getByLabelText('They hosted me'));

    fireEvent.click(getAllByText('Next')[0]);

    expect(
      queryByLabelText('Would you recommend others to stay with them?'),
    ).toBeInTheDocument();
    fireEvent.click(getByText('Yes'));

    fireEvent.click(getAllByText('Next')[0]);

    expect(
      queryByLabelText(
        'Would you like to describe something about them? (Optional)',
      ),
    ).toBeInTheDocument();
    fireEvent.change(getByLabelText('Public feedback'), {
      target: { value: 'they made a tasty pie' },
    });

    fireEvent.click(getAllByText('Finish')[0]);

    expect(api.references.create).toHaveBeenCalledWith({
      met: false,
      hostedMe: true,
      hostedThem: false,
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
    api.references.readMine.mockResolvedValueOnce(null);
    api.references.create.mockResolvedValueOnce({ public: false });

    const {
      getByText,
      getAllByText,
      getByLabelText,
      queryByLabelText,
    } = render(<CreateReference userFrom={userFrom} userTo={userTo} />);

    await waitForLoader();

    expect(queryByLabelText('How do you know them?')).toBeInTheDocument();
    fireEvent.click(getByLabelText('They hosted me'));

    fireEvent.click(getAllByText('Next')[0]);

    expect(
      queryByLabelText('Would you recommend others to stay with them?'),
    ).toBeInTheDocument();
    fireEvent.click(getByText('No'));

    fireEvent.click(getByText('Privately report this person to moderators'));
    fireEvent.change(getByLabelText('Message to moderators'), {
      target: { value: 'they were mean to me' },
    });

    fireEvent.click(getAllByText('Next')[0]);

    fireEvent.click(getAllByText('Finish')[0]);

    expect(api.references.create).toHaveBeenCalledWith({
      met: false,
      hostedMe: true,
      hostedThem: false,
      recommend: 'no',
      feedbackPublic: '',
      userTo: userTo._id,
    });

    expect(api.references.report).toHaveBeenCalledWith(
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
