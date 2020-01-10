import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Inbox from '@/modules/messages/client/components/Inbox.component';
import * as api from '@/modules/messages/client/api/messages.api';

jest.mock('@/modules/messages/client/api/messages.api');
jest.mock('@/modules/core/client/services/angular-compat');

afterEach(() => jest.clearAllMocks());

const me = {
  _id: '6e1719d8a8098fb2ce44160b',
  public: true,
  username: 'testuser',
  displayName: 'test user',
};

const threads = [
  {
    _id: '5e1719d8a8098fb2ce44160a',
    read: true,
    updated: '2020-01-09T12:17:28.967Z',
    message: {
      excerpt: 'a nice message',
    },
    userFrom: {
      _id: '5de7ec33f333ce7b23cdfa26',
      username: 'admin1',
      displayName: 'Newell Jones',
    },
    userTo: {
      _id: '5de7ec34f333ce7b23cdfcd2',
      username: 'madyson',
      displayName: 'Madyson Morissette',
    },
  },
  {
    _id: '5de7ec8bb633f67cf0dbc265',
    read: true,
    updated: '2020-01-02T21:52:04.154Z',
    message: {
      excerpt: 'why does that go funny?',
    },
    userFrom: {
      _id: '5de7ec33f333ce7b23cdfa26',
      username: 'admin1',
      displayName: 'Newell Jones',
    },
    userTo: {
      _id: '5de7ec34f333ce7b23cdfc61',
      username: '571eloyhintz',
      displayName: 'Eloy Hintz',
    },
  },
];

describe('<Inbox>', () => {

  it('shows a nice message if there are no conversations', async () => {
    api.fetchThreads.mockResolvedValue({ threads: [] });
    const { findByRole } = render(<Inbox user={me}/>);
    expect(await findByRole('alert')).toHaveTextContent('No conversations yet.');
    expect(api.fetchThreads).toHaveBeenCalled();
  });

  it('shows a list of threads with excerpts', async () => {
    api.fetchThreads.mockResolvedValue({ threads });
    const { findAllByRole } = render(<Inbox user={me}/>);
    const items = await findAllByRole('listitem');
    expect(items.length).toBe(threads.length);
    threads.forEach((thread, i) => {
      expect(items[i]).toHaveTextContent(thread.message.excerpt);
    });
  });

  it('shows a read more button if there are more results', async () => {
    api.fetchThreads.mockResolvedValue({ threads, nextParams: { foo: 'bar' } });
    const { findByRole } = render(<Inbox user={me}/>);
    expect(await findByRole('button')).toHaveTextContent('More messages');
  });

});
