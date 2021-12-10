import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
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
    const { findByRole } = render(<Inbox user={me} />);
    expect(await findByRole('alert')).toHaveTextContent(
      'No conversations yet.',
    );
    expect(api.fetchThreads).toHaveBeenCalled();
  });

  it('shows a list of threads with excerpts', async () => {
    api.fetchThreads.mockResolvedValue({ threads });
    const { findAllByRole } = render(<Inbox user={me} />);
    const items = await findAllByRole('listitem');
    expect(items.length).toBe(threads.length);
    threads.forEach((thread, i) => {
      expect(items[i]).toHaveTextContent(thread.message.excerpt);
    });
  });

  it('shows that I have replied if the last message is from me', async () => {
    const threads = generateThreads(1, { userFrom: me });
    api.fetchThreads.mockResolvedValue({ threads });
    const { container, findByRole } = render(<Inbox user={me} />);
    await findByRole('listitem');
    const icon = container.querySelector('.icon-reply');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('title', 'You replied');
  });

  it('does not show that I have replied if the last message is from them', async () => {
    const threads = generateThreads(1, { userTo: me });
    api.fetchThreads.mockResolvedValue({ threads });
    const { container, findByRole } = render(<Inbox user={me} />);
    await findByRole('listitem');
    const icon = container.querySelector('.icon-reply');
    expect(icon).not.toBeInTheDocument();
  });

  it('shows a read more button if there are more results', async () => {
    api.fetchThreads.mockResolvedValue({ threads, nextParams: { foo: 'bar' } });
    const { findByRole } = render(<Inbox user={me} />);
    expect(await findByRole('button')).toHaveTextContent('More messages');
  });

  it('will load the next page on clicking the button', async () => {
    api.fetchThreads.mockImplementation(({ page }) =>
      Promise.resolve(
        page === 2
          ? { threads: moreThreads }
          : { threads, nextParams: { page: 2 } },
      ),
    );
    const { findByText, queryAllByRole } = render(<Inbox user={me} />);
    const more = await findByText('More messages');

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

    await findByText(moreThreads[moreThreads.length - 1].message.excerpt);

    const items = queryAllByRole('listitem');
    expect(items.length).toBe(threads.length + moreThreads.length);

    expect(eventTrack).toHaveBeenCalledWith('inbox-pagination', {
      category: 'messages.inbox',
      label: 'Inbox page 2',
    });
  });
});
