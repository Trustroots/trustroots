import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import '@/config/client/i18n';
import Inbox from '@/modules/messages/client/components/Inbox.component';
import * as api from '@/modules/messages/client/api/messages.api';
import {
  generateClientUser,
  generateThreads,
} from '@/testutils/client/data.client.testutil';
import { trackEvent } from '@/modules/core/client/services/client-runtime';

jest.mock('@/modules/messages/client/api/messages.api');
jest.mock('@/modules/core/client/services/client-runtime');

afterEach(() => {
  jest.clearAllMocks();
  window.history.replaceState(null, '', '/messages');
});

const me = generateClientUser({ public: true });
const threads = generateThreads(10);
const moreThreads = generateThreads(7);

describe('<Inbox>', () => {
  it('asks private users to activate their profile before loading threads', () => {
    const privateUser = generateClientUser({ public: false });

    const { getByRole } = render(<Inbox user={privateUser} />);

    expect(getByRole('alertdialog')).toHaveTextContent(
      'Sorry, you need to first activate your profile',
    );
    expect(api.fetchThreads).not.toHaveBeenCalled();
  });

  it('shows a nice message if there are no conversations', async () => {
    api.fetchThreads.mockResolvedValue({ threads: [] });
    const { findByRole } = render(<Inbox user={me} />);
    expect(await findByRole('alert')).toHaveTextContent(
      'No conversations yet.',
    );
    expect(api.fetchThreads).toHaveBeenCalled();
  });

  it('loads only unread conversations when the unread view is selected', async () => {
    window.history.replaceState(null, '', '/messages?filter=unread');
    api.fetchThreads.mockResolvedValue({ threads: [] });

    const { findByRole, getByRole } = render(<Inbox user={me} />);

    expect(await findByRole('alert')).toHaveTextContent(
      'No unread conversations.',
    );
    expect(api.fetchThreads).toHaveBeenCalledWith({ filter: 'unread' });
    expect(getByRole('link', { name: 'Unread conversations' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('keeps the unread filter when loading older conversations', async () => {
    window.history.replaceState(null, '', '/messages?filter=unread');
    api.fetchThreads.mockImplementation(({ page }) =>
      Promise.resolve(
        page === 2
          ? { threads: moreThreads }
          : { threads, nextParams: { page: 2 } },
      ),
    );
    const { findByRole } = render(<Inbox user={me} />);

    fireEvent.click(await findByRole('button', { name: 'More messages' }));

    await waitFor(() =>
      expect(api.fetchThreads).toHaveBeenCalledWith({
        page: 2,
        filter: 'unread',
      }),
    );
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

    expect(trackEvent).toHaveBeenCalledWith('inbox-pagination', {
      category: 'messages.inbox',
      label: 'Inbox page 2',
    });
  });

  it('filters by member name and latest preview across older pages', async () => {
    const firstPage = generateThreads(1);
    const olderPage = generateThreads(1);
    firstPage[0].userFrom.displayName = 'First member';
    firstPage[0].userTo.displayName = 'Viewer';
    firstPage[0].message.excerpt = 'First preview';
    olderPage[0].userFrom.displayName = 'Second member';
    olderPage[0].userTo.displayName = 'Viewer';
    olderPage[0].message.excerpt = 'Hidden in an older page';
    api.fetchThreads.mockImplementation(({ page }) =>
      Promise.resolve(
        page === 2
          ? { threads: olderPage }
          : { threads: firstPage, nextParams: { page: 2 } },
      ),
    );

    const { findByRole, getByRole, getByText, queryByText } = render(
      <Inbox user={me} />,
    );
    await findByRole('listitem');
    fireEvent.change(getByRole('searchbox', { name: 'Filter conversations' }), {
      target: { value: 'older page' },
    });

    await waitFor(() => {
      expect(api.fetchThreads).toHaveBeenCalledWith({ page: 2 });
      expect(getByText('Second member')).toBeInTheDocument();
    });
    expect(queryByText('First member')).not.toBeInTheDocument();

    fireEvent.change(getByRole('searchbox', { name: 'Filter conversations' }), {
      target: { value: 'First member' },
    });
    expect(getByText('First member')).toBeInTheDocument();
    expect(queryByText('Second member')).not.toBeInTheDocument();
  });

  it('shows when no conversations match the filter', async () => {
    api.fetchThreads.mockResolvedValue({ threads });
    const { findAllByRole, getByRole } = render(<Inbox user={me} />);
    await findAllByRole('listitem');

    fireEvent.change(getByRole('searchbox', { name: 'Filter conversations' }), {
      target: { value: 'no matching member or preview' },
    });

    expect(getByRole('alert')).toHaveTextContent('No matching conversations.');
  });

  it('searches the other member in a conversation I sent', async () => {
    const sentThreads = generateThreads(1, { userFrom: me });
    sentThreads[0].userTo.displayName = 'Matching Recipient';
    api.fetchThreads.mockResolvedValue({ threads: sentThreads });
    const { findByText, getByRole } = render(<Inbox user={me} />);
    await findByText('Matching Recipient');

    fireEvent.change(getByRole('searchbox', { name: 'Filter conversations' }), {
      target: { value: 'Matching Recipient' },
    });

    expect(await findByText('Matching Recipient')).toBeInTheDocument();
  });

  it('keeps the unread filter while searching older pages', async () => {
    window.history.replaceState(null, '', '/messages?filter=unread');
    const firstPage = generateThreads(1);
    const olderPage = generateThreads(1);
    olderPage[0].message.excerpt = 'Older matching preview';
    api.fetchThreads.mockImplementation(({ page }) =>
      Promise.resolve(
        page === 2
          ? { threads: olderPage }
          : { threads: firstPage, nextParams: { page: 2 } },
      ),
    );
    const { findByRole, findByText, getByRole } = render(<Inbox user={me} />);
    await findByRole('listitem');

    fireEvent.change(getByRole('searchbox', { name: 'Filter conversations' }), {
      target: { value: 'Older matching' },
    });

    expect(await findByText('Older matching preview')).toBeInTheDocument();
    expect(api.fetchThreads).toHaveBeenCalledWith({
      page: 2,
      filter: 'unread',
    });
  });

  it('announces when older conversations are being searched', async () => {
    const finishOlderPage = jest.fn();
    api.fetchThreads.mockImplementation(({ page }) =>
      page === 2
        ? new Promise(resolve => finishOlderPage.mockImplementation(resolve))
        : Promise.resolve({ threads, nextParams: { page: 2 } }),
    );
    const { findAllByRole, findByRole, getByRole } = render(
      <Inbox user={me} />,
    );
    await findAllByRole('listitem');

    fireEvent.change(getByRole('searchbox', { name: 'Filter conversations' }), {
      target: { value: 'older' },
    });

    expect(await findByRole('status')).toHaveTextContent(
      'Searching older conversations…',
    );
    await act(async () => {
      finishOlderPage({ threads: [] });
    });
  });

  it('reports a failure while loading older conversations for search', async () => {
    api.fetchThreads.mockImplementation(({ page }) =>
      page === 2
        ? Promise.reject(new Error('Page unavailable'))
        : Promise.resolve({ threads, nextParams: { page: 2 } }),
    );
    const { findAllByRole, findByText, getByRole } = render(
      <Inbox user={me} />,
    );
    await findAllByRole('listitem');

    fireEvent.change(getByRole('searchbox', { name: 'Filter conversations' }), {
      target: { value: 'missing' },
    });

    expect(
      await findByText('Older conversations could not be loaded.'),
    ).toBeInTheDocument();
  });
});
