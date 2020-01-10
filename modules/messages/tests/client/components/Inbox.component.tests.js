import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Inbox from '@/modules/messages/client/components/Inbox.component';
import * as api from '@/modules/messages/client/api/messages.api';
import { generateClientUser, generateThreads } from '@/testutils/client/data.client.testutil';

jest.mock('@/modules/messages/client/api/messages.api');
jest.mock('@/modules/core/client/services/angular-compat');

afterEach(() => jest.clearAllMocks());

const me = generateClientUser({ public: true });
const threads = generateThreads(10);

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
