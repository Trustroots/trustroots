import React from 'react';
import {
  render,
  screen,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Thread from '@/modules/messages/client/components/Thread.component';
import * as usersAPI from '@/modules/users/client/api/users.api';
import * as messagesAPI from '@/modules/messages/client/api/messages.api';
import {
  generateClientUser,
  generateMessage,
} from '@/testutils/client/data.client.testutil';
import { getRouteParams } from '@/modules/core/client/services/angular-compat';

const api = {
  users: usersAPI,
  messages: messagesAPI,
};

jest.mock('@/modules/users/client/api/users.api');
jest.mock('@/modules/messages/client/api/messages.api');
jest.mock('@/modules/core/client/services/angular-compat');

afterEach(() => jest.clearAllMocks());

const me = {
  ...generateClientUser({ public: true }),
  memberIds: [],
};
const otherUser = {
  ...generateClientUser({ public: true }),
  member: [],
};

getRouteParams.mockReturnValue({
  username: otherUser.username,
});

async function waitForLoader() {
  await waitForElementToBeRemoved(() => screen.queryByText('Wait a moment…'));
}

describe('<Thread>', () => {
  beforeEach(() => {
    api.users.fetch.mockResolvedValueOnce(otherUser);
  });

  describe('no messages', () => {
    beforeEach(() => {
      api.messages.fetchMessages.mockResolvedValueOnce({ messages: [] });
    });

    it('does not allow sending a message when the profile is too short', async () => {
      render(<Thread user={me} profileMinimumLength={9999} />);
      await screen.findByText(/Your profile seems quite empty/);
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(api.users.fetch).toHaveBeenCalledWith(otherUser.username);
      expect(api.messages.fetchMessages).toHaveBeenCalledWith(otherUser._id);
    });

    it('shows reply box if profile is long enough', async () => {
      render(<Thread user={me} profileMinimumLength={0} />);
      const form = await screen.findByRole('form');
      expect(
        screen.getByText(/You haven't been talking yet/),
      ).toBeInTheDocument();
      expect(within(form).getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('only messages from other user', () => {
    beforeEach(() => {
      api.messages.fetchMessages.mockResolvedValueOnce({
        messages: [generateMessage(otherUser)],
      });
    });

    it.skip('shows quick reply buttons', async () => {
      render(<Thread user={me} profileMinimumLength={0} />);
      await waitForLoader();
      const quickReply = screen.getByTestId('quick-reply');
      const buttons = within(quickReply).queryAllByRole('button');
      expect(buttons.length).toBe(3);
      ['Yes, I can host!', "Sorry I can't host", 'Write back'].forEach(
        (content, i) => {
          expect(buttons[i]).toHaveTextContent(content);
        },
      );
    });
  });

  describe('messages from both users', () => {
    beforeEach(() => {
      api.messages.fetchMessages.mockResolvedValueOnce({
        messages: [generateMessage(otherUser), generateMessage(me)],
      });
    });

    it('does not show the quick reply buttons', async () => {
      render(<Thread user={me} profileMinimumLength={0} />);
      await waitForLoader();
      expect(screen.queryByTestId('quick-reply')).not.toBeInTheDocument();
    });
  });
});
