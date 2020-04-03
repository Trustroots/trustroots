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
  await waitForElementToBeRemoved(() => screen.getByText('Wait a moment...'));
}

describe('<CreateReference />', () => {
  let userFrom;
  let userTo;

  beforeEach(() => {
    userFrom = { _id: '111111', username: 'userfrom' };
    userTo = { _id: '222222', username: 'userto' };
  });

  it('should not be possible to leave a reference to self', () => {
    const me = { _id: '123456', username: 'username' };
    api.references.read.mockResolvedValueOnce([]);
    const { queryByRole } = render(
      <CreateReference userFrom={me} userTo={me} />,
    );
    expect(queryByRole('alert')).toHaveTextContent(
      "Sorry, you can't give a reference to yourself.",
    );
  });

  it('check whether the reference exists at the beginning', () => {
    api.references.read.mockResolvedValueOnce([]);
    render(<CreateReference userFrom={userFrom} userTo={userTo} />);
    expect(api.references.read).toBeCalledWith({
      userFrom: userFrom._id,
      userTo: userTo._id,
    });
  });

  it('can not leave a second reference', async () => {
    api.references.read.mockResolvedValueOnce([
      { userFrom, userTo, public: false },
    ]);
    const { queryByRole } = render(
      <CreateReference userFrom={userFrom} userTo={userTo} />,
    );
    await waitForLoader();
    expect(queryByRole('alert')).toHaveTextContent(
      `You've already given a reference to ${userTo.username}.`,
    );
    expect(api.references.read).toBeCalledWith({
      userFrom: userFrom._id,
      userTo: userTo._id,
    });
  });

  it('can leave a reference (reference form is available)', async () => {
    api.references.read.mockResolvedValueOnce([]);
    const { queryByLabelText } = render(
      <CreateReference userFrom={userFrom} userTo={userTo} />,
    );
    await waitForLoader();
    for (const label of ['Met in person', 'I hosted them', 'They hosted me']) {
      expect(queryByLabelText(label)).toBeInTheDocument();
    }
  });

  it('submit a reference', async () => {
    api.references.read.mockResolvedValueOnce([]);
    api.references.create.mockResolvedValueOnce({ public: false });

    const { getByText, getByLabelText, queryByLabelText, queryByRole } = render(
      <CreateReference userFrom={userFrom} userTo={userTo} />,
    );

    await waitForLoader();

    expect(queryByLabelText('How do you know them?')).toBeInTheDocument();
    fireEvent.click(getByLabelText('They hosted me'));

    fireEvent.click(getByText('Next'));

    expect(
      queryByLabelText('Would you recommend others to stay with them?'),
    ).toBeInTheDocument();
    fireEvent.click(getByText('Yes'));

    fireEvent.click(getByText('Finish'));

    expect(api.references.create).toHaveBeenCalledWith({
      met: false,
      hostedMe: true,
      hostedThem: false,
      recommend: 'yes',
      userTo: userTo._id,
    });

    const alert = await waitForElement(() => queryByRole('alert'));
    expect(alert).toHaveTextContent(
      `Your reference will become public when ${userTo.username} gives you a reference back, or in 14 days.`,
    );
  });

  it('submit a report when recommend is no and user wants to send a report', async () => {
    api.references.read.mockResolvedValueOnce([]);
    api.references.create.mockResolvedValueOnce({ public: false });

    const { getByText, getByLabelText, queryByLabelText, queryByRole } = render(
      <CreateReference userFrom={userFrom} userTo={userTo} />,
    );

    await waitForLoader();

    expect(queryByLabelText('How do you know them?')).toBeInTheDocument();
    fireEvent.click(getByLabelText('They hosted me'));

    fireEvent.click(getByText('Next'));

    expect(
      queryByLabelText('Would you recommend others to stay with them?'),
    ).toBeInTheDocument();
    fireEvent.click(getByText('No'));

    fireEvent.click(getByText('Report this person to moderators'));
    fireEvent.change(getByLabelText('Message to moderators'), {
      target: { value: 'they were mean to me' },
    });

    fireEvent.click(getByText('Finish'));

    expect(api.references.create).toHaveBeenCalledWith({
      met: false,
      hostedMe: true,
      hostedThem: false,
      recommend: 'no',
      userTo: userTo._id,
    });

    expect(api.references.report).toHaveBeenCalledWith(
      userTo,
      'they were mean to me',
    );

    const alert = await waitForElement(() => queryByRole('alert'));
    expect(alert).toHaveTextContent(
      `Your reference will become public when ${userTo.username} gives you a reference back, or in 14 days.`,
    );
    expect(alert).toHaveTextContent(`Also, ${userTo.username} was reported.`);
  });
});
