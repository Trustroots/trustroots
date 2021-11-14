import React from 'react';
import { screen, render, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import '@/config/client/i18n';
import Inbox from '@/modules/messages/client/components/Inbox.component';
import * as api from '@/modules/messages/client/api/messages.api';
import {
  generateClientUser,
  generateThreads,
} from '@/testutils/client/data.client.testutil';
import { eventTrack } from '@/modules/core/client/services/angular-compat';

jest.mock('@/modules/messages/client/api/messages.api');
jest.mock('@/modules/core/client/services/angular-compat');

afterEach(() => jest.clearAllMocks());

const me = generateClientUser({ public: true });
const threads = generateThreads(10);
const moreThreads = generateThreads(7);

describe('<Inbox>', () => {
  it('shows a nice message if there are no conversations', async () => {
    api.fetchThreads.mockResolvedValue({ threads: [] });
    render(<Inbox user={me} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No conversations yet.',
    );
    expect(api.fetchThreads).toHaveBeenCalled();
  });

  it('shows a list of threads with excerpts', async () => {
    api.fetchThreads.mockResolvedValue({ threads });
    render(<Inbox user={me} />);
    const items = await screen.findAllByRole('listitem');
    expect(items.length).toBe(threads.length);
    threads.forEach((thread, i) => {
      expect(items[i]).toHaveTextContent(thread.message.excerpt);
    });
  });

  it('shows that I have replied if the last message is from me', async () => {
    const threads = generateThreads(1, { userFrom: me });
    api.fetchThreads.mockResolvedValue({ threads });
    render(<Inbox user={me} />);
    await screen.findByRole('listitem');
    expect(screen.getByTitle('You replied')).toBeInTheDocument();
  });

  it('does not show that I have replied if the last message is from them', async () => {
    const threads = generateThreads(1, { userTo: me });
    api.fetchThreads.mockResolvedValue({ threads });
    render(<Inbox user={me} />);
    await screen.findByRole('listitem');
    expect(screen.queryByTitle('You replied')).not.toBeInTheDocument();
  });

  it('shows a read more button if there are more results', async () => {
    api.fetchThreads.mockResolvedValue({ threads, nextParams: { foo: 'bar' } });
    render(<Inbox user={me} />);
    expect(await screen.findByRole('button')).toHaveTextContent(
      'More messages',
    );
  });

  it('will load the next page on clicking the button', async () => {
    api.fetchThreads.mockImplementation(({ page }) =>
      Promise.resolve(
        page === 2
          ? { threads: moreThreads }
          : { threads, nextParams: { page: 2 } },
      ),
    );
    render(<Inbox user={me} />);
    const more = await screen.findByText('More messages');

    // Not sure why I had to wrap this in act()
    //
    // According to the docs [0] it should have worked if I just wait
    // to see the excerpt from the more messages but instead I get
    // an error pointing me to react docs [1]
    //
    // [1] https://testing-library.com/docs/react-testing-library/faq
    // [2] https://reactjs.org/docs/test-utils.html#act
    await act(async () => {
      await fireEvent.click(more);
    });

    await screen.findByText(
      moreThreads[moreThreads.length - 1].message.excerpt,
    );

    const items = screen.queryAllByRole('listitem');
    expect(items.length).toBe(threads.length + moreThreads.length);

    expect(eventTrack).toHaveBeenCalledWith('inbox-pagination', {
      category: 'messages.inbox',
      label: 'Inbox page 2',
    });
  });
});
