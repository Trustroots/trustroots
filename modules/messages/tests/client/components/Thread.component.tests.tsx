import { useParams } from '@tanstack/react-router';
import React from 'react';
import {
  act,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import '@/config/client/i18n';
import Thread from '@/modules/messages/client/components/Thread.component';
import * as usersAPI from '@/modules/users/client/api/users.api';
import * as messagesAPI from '@/modules/messages/client/api/messages.api';
import {
  malformedFixture,
  resolveMalformed,
} from '@/testutils/client/malformed-fixtures';
import { update as updateUnreadMessageCount } from '@/modules/messages/client/services/unread-message-count.client.service';
import { fakeAnalytics } from '@/testutils/client/analytics.testutil';
import { rememberOutreachSource } from '@trustroots/analytics/client';
import {
  generateClientUser,
  generateMessage,
} from '@/testutils/client/data.client.testutil';
import type { UserProfile } from '@/modules/users/client/types';
import type {
  Message,
  MessageUser,
} from '@/modules/messages/client/api/messages.api';

let analytics = fakeAnalytics();
const render = (ui: React.ReactElement) =>
  rtlRender(ui, { wrapper: analytics.wrapper });

const api = {
  users: { fetch: vi.mocked(usersAPI.fetch) },
  messages: {
    fetchMessages: vi.mocked(messagesAPI.fetchMessages),
    fetchHostingContext: vi.mocked(messagesAPI.fetchHostingContext),
    sendMessage: vi.mocked(messagesAPI.sendMessage),
    markRead: vi.mocked(messagesAPI.markRead),
  },
};
const updateUnreadCount = vi.mocked(updateUnreadMessageCount);
const showThread = ({ username, userId }: typeof routeParams) =>
  window.history.pushState(
    {},
    '',
    `/messages/${username}${userId ? `?userId=${userId}` : ''}`,
  );

vi.mock('@tanstack/react-router', async () =>
  (
    await import('@/testutils/client/router-location.testutil')
  ).mockRouterModule(),
);
vi.mock('@/modules/users/client/api/users.api');
vi.mock('@/modules/messages/client/api/messages.api');
vi.mock(
  '@/modules/messages/client/services/unread-message-count.client.service',
);
let mockIsExtraSmall = true;
vi.mock('@/modules/core/client/hooks/use-media-query', async () => ({
  ...(await vi.importActual<object>(
    '@/modules/core/client/hooks/use-media-query',
  )),
  __esModule: true,
  default: () => mockIsExtraSmall,
}));
vi.mock('@/modules/users/client/components/Monkeybox', () => {
  return {
    default: function MockMonkeybox() {
      return <div data-testid="monkeybox" />;
    },
  };
});
vi.mock('@/modules/support/client/components/ReportMember.component', () => {
  function MockReportMember({ username }: { username?: string }) {
    return <button type="button">Report {username}</button>;
  }
  return { default: MockReportMember };
});
vi.mock('@/modules/users/client/components/BlockMember.component', () => {
  function MockBlockMember({ username }: { username?: string }) {
    return <button type="button">Block {username}</button>;
  }
  return { default: MockBlockMember };
});
vi.mock('@/modules/references-thread/client/components/ReferenceThread', () => {
  function MockReferenceThread({ userToId }: { userToId: string }) {
    return <div>References for {userToId}</div>;
  }
  return { default: MockReferenceThread };
});
vi.mock('@/modules/core/client/components/TrEditor', () => {
  function MockTrEditor({
    id,
    onChange,
    text,
  }: {
    id?: string;
    onChange: (value: string) => void;
    text: string;
  }) {
    return (
      <textarea
        id={id}
        onChange={event => onChange(event.target.value)}
        value={text}
      />
    );
  }
  return { default: MockTrEditor };
});

const me: React.ComponentProps<typeof Thread>['user'] = {
  ...generateClientUser({ public: true }),
  username: 'test-member',
};
const otherUser: UserProfile = {
  ...generateClientUser({ public: true }),
  member: [],
};

function createMessage(
  userFrom: MessageUser,
  overrides: Partial<Message> = {},
): Message {
  return {
    ...generateMessage(userFrom),
    read: false,
    userFrom,
    userTo: me,
    ...overrides,
  };
}

beforeEach(() => {
  analytics = fakeAnalytics();
  api.users.fetch.mockReset();
  api.messages.fetchMessages.mockReset();
  api.messages.fetchHostingContext.mockReset();
  api.messages.sendMessage.mockReset();
  api.messages.markRead.mockReset();

  api.users.fetch.mockResolvedValue(otherUser);
  api.messages.fetchMessages.mockResolvedValue({ messages: [] });
  api.messages.fetchHostingContext.mockResolvedValue({
    description: 'Please arrive before sunset.',
    acknowledgementRequired: false,
  });
  api.messages.markRead.mockResolvedValue();
});

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

let routeParams: { username: string; userId?: string } = {
  username: otherUser.username,
};

showThread(routeParams);

describe('<Thread>', () => {
  it('does not load hosting context until hosting mode is selected', async () => {
    render(<Thread user={me} profileMinimumLength={0} />);
    await screen.findByRole('textbox');
    expect(api.messages.fetchHostingContext).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Add hosting details' }),
    );
    expect(
      await screen.findByText('Please arrive before sunset.'),
    ).toBeVisible();
    expect(api.messages.fetchHostingContext).toHaveBeenCalledWith(
      otherUser._id,
    );
  });

  it('sends an ordinary message to an opted-in host without loading hosting context', async () => {
    api.messages.sendMessage.mockResolvedValueOnce({
      data: createMessage(me),
    } as Awaited<ReturnType<typeof messagesAPI.sendMessage>>);
    render(<Thread user={me} profileMinimumLength={0} />);
    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: 'A fictional ordinary hello.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send/ }));
    await waitFor(() =>
      expect(api.messages.sendMessage).toHaveBeenCalledWith(
        otherUser._id,
        'A fictional ordinary hello.',
      ),
    );
    expect(api.messages.fetchHostingContext).not.toHaveBeenCalled();
  });

  it('sends optional hosting details and requires acknowledgement only when the context says so', async () => {
    api.messages.fetchHostingContext.mockResolvedValueOnce({
      description: 'Please arrive before sunset.',
      acknowledgementRequired: true,
    });
    api.messages.sendMessage.mockResolvedValueOnce({
      data: createMessage(me),
    } as Awaited<ReturnType<typeof messagesAPI.sendMessage>>);
    render(<Thread user={me} profileMinimumLength={0} />);
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Add hosting details' }),
    );
    const ack = await screen.findByRole('checkbox', {
      name: 'I have read this host’s hosting description and requirements.',
    });
    expect(ack).not.toBeChecked();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'A fictional hosting request.' },
    });
    fireEvent.change(screen.getByLabelText('Guests'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Arrival (optional)'), {
      target: { value: '2026-08-10' },
    });
    fireEvent.change(screen.getByLabelText('Departure (optional)'), {
      target: { value: '2026-08-13' },
    });
    expect(screen.getByRole('button', { name: /Send/ })).toBeDisabled();
    fireEvent.click(ack);
    expect(screen.getByRole('button', { name: /Send/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Send/ }));
    await waitFor(() =>
      expect(api.messages.sendMessage).toHaveBeenCalledWith(
        otherUser._id,
        'A fictional hosting request.',
        true,
        { guests: 2, arrival: '2026-08-10', departure: '2026-08-13' },
      ),
    );
  });

  it('finishes an in-flight hosting send after the guest switches modes', async () => {
    let resolveSend!: (
      response: Awaited<ReturnType<typeof messagesAPI.sendMessage>>,
    ) => void;
    api.messages.sendMessage.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveSend = resolve;
        }),
    );
    render(<Thread user={me} profileMinimumLength={0} />);
    const hostingToggle = await screen.findByRole('checkbox', {
      name: 'Add hosting details',
    });
    fireEvent.click(hostingToggle);
    await screen.findByText('Please arrive before sunset.');
    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: 'A fictional in-flight hosting request.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send/ }));
    await waitFor(() => expect(api.messages.sendMessage).toHaveBeenCalled());

    fireEvent.click(hostingToggle);
    expect(hostingToggle).not.toBeChecked();
    expect(
      screen.queryByText('Please arrive before sunset.'),
    ).not.toBeInTheDocument();
    await act(async () => {
      resolveSend({ data: createMessage(me) } as Awaited<
        ReturnType<typeof messagesAPI.sendMessage>
      >);
    });

    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
    expect(
      screen.getByRole('checkbox', { name: 'Add hosting details' }),
    ).not.toBeChecked();
  });

  it('refreshes a newly required acknowledgement and preserves the draft and details', async () => {
    api.messages.fetchHostingContext
      .mockResolvedValueOnce({
        description: 'Please arrive before sunset.',
        acknowledgementRequired: false,
      })
      .mockResolvedValueOnce({
        description: 'Please arrive before sunset.',
        acknowledgementRequired: true,
      });
    api.messages.sendMessage
      .mockRejectedValueOnce({
        response: {
          status: 400,
          data: { error: 'hosting-description-acknowledgement-required' },
        },
      })
      .mockResolvedValueOnce({ data: createMessage(me) } as Awaited<
        ReturnType<typeof messagesAPI.sendMessage>
      >);
    render(<Thread user={me} profileMinimumLength={0} />);
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Add hosting details' }),
    );
    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: 'A saved draft.' },
    });
    fireEvent.change(screen.getByLabelText('Guests'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send/ }));
    const checkbox = await screen.findByRole('checkbox', {
      name: 'I have read this host’s hosting description and requirements.',
    });
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText('Please arrive before sunset.')).toBeVisible();
    expect(screen.getByRole('textbox')).toHaveValue('A saved draft.');
    expect(screen.getByLabelText('Guests')).toHaveValue(3);
    expect(screen.getByRole('button', { name: /Send/ })).toBeDisabled();
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /Send/ }));
    await waitFor(() =>
      expect(api.messages.sendMessage).toHaveBeenLastCalledWith(
        otherUser._id,
        'A saved draft.',
        true,
        { guests: 3 },
      ),
    );
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
  });

  it('keeps ordinary messages available when hosting context cannot load', async () => {
    api.messages.fetchHostingContext.mockRejectedValueOnce(
      new Error('offline'),
    );
    api.messages.sendMessage.mockResolvedValueOnce({
      data: createMessage(me),
    } as Awaited<ReturnType<typeof messagesAPI.sendMessage>>);
    render(<Thread user={me} profileMinimumLength={0} />);
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Add hosting details' }),
    );
    await screen.findByRole('alert');
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'A saved draft.' },
    });
    expect(screen.getByRole('button', { name: /Send/ })).toBeDisabled();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Add hosting details' }),
    );
    expect(screen.getByRole('button', { name: /Send/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Send/ }));
    await waitFor(() =>
      expect(api.messages.sendMessage).toHaveBeenCalledWith(
        otherUser._id,
        'A saved draft.',
      ),
    );
  });

  it('retries failed hosting context loading without losing the draft', async () => {
    api.messages.fetchHostingContext
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        description: 'Please arrive before sunset.',
        acknowledgementRequired: false,
      });
    render(<Thread user={me} profileMinimumLength={0} />);
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Add hosting details' }),
    );
    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: 'A saved hosting draft.' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await screen.findByText('Please arrive before sunset.');
    expect(screen.getByRole('textbox')).toHaveValue('A saved hosting draft.');
    expect(api.messages.fetchHostingContext).toHaveBeenCalledTimes(2);
  });

  it('ignores a hosting context response after switching back to ordinary messaging', async () => {
    let resolveFirst!: (context: {
      description: string;
      acknowledgementRequired: boolean;
    }) => void;
    api.messages.fetchHostingContext
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({
        description: 'Fresh hosting description.',
        acknowledgementRequired: true,
      });
    render(<Thread user={me} profileMinimumLength={0} />);
    const hostingToggle = await screen.findByRole('checkbox', {
      name: 'Add hosting details',
    });
    fireEvent.click(hostingToggle);
    fireEvent.click(hostingToggle);
    resolveFirst({
      description: 'Stale hosting description.',
      acknowledgementRequired: true,
    });
    expect(await screen.findByRole('textbox')).toBeEnabled();
    expect(
      screen.queryByText('Stale hosting description.'),
    ).not.toBeInTheDocument();
    fireEvent.click(hostingToggle);
    expect(await screen.findByText('Fresh hosting description.')).toBeVisible();
    expect(api.messages.fetchHostingContext).toHaveBeenCalledTimes(2);
  });

  it('ignores a failed hosting context request after switching back to ordinary messaging', async () => {
    let rejectFirst!: (error: Error) => void;
    api.messages.fetchHostingContext.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectFirst = reject;
        }),
    );
    render(<Thread user={me} profileMinimumLength={0} />);
    const hostingToggle = await screen.findByRole('checkbox', {
      name: 'Add hosting details',
    });
    fireEvent.click(hostingToggle);
    fireEvent.click(hostingToggle);
    rejectFirst(new Error('stale request failure'));
    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send/ })).toBeEnabled();
  });
  let originalVisualViewport: PropertyDescriptor | undefined;

  beforeEach(() => {
    api.users.fetch.mockResolvedValue(otherUser);
    mockIsExtraSmall = true;
    routeParams = {
      username: otherUser.username,
    };
    showThread(routeParams);
  });

  afterEach(() => {
    if (originalVisualViewport) {
      Object.defineProperty(window, 'visualViewport', originalVisualViewport);
    } else {
      Reflect.deleteProperty(window, 'visualViewport');
    }
    originalVisualViewport = undefined;
  });

  it('resizes the mobile thread above the on-screen keyboard', async () => {
    api.messages.fetchMessages.mockResolvedValueOnce({
      messages: [createMessage(otherUser, { hostingDetails: { guests: 1 } })],
    });
    const windowHeight = window.innerHeight;
    const readKeyboardInset = () =>
      document.documentElement.style.getPropertyValue(
        '--trustroots-keyboard-inset',
      );
    const expectedKeyboardInset = (height: number, offsetTop: number) =>
      `${Math.round(windowHeight - height - offsetTop)}px`;
    originalVisualViewport = Object.getOwnPropertyDescriptor(
      window,
      'visualViewport',
    );
    const viewportListeners: Record<string, () => void> = {};
    const visualViewport = {
      height: 500.4,
      offsetTop: 20.2,
      addEventListener: vi.fn((event: string, listener: () => void) => {
        viewportListeners[event] = listener;
      }),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visualViewport,
    });
    api.messages.fetchMessages.mockResolvedValueOnce({
      messages: [createMessage(otherUser)],
    });
    const { unmount } = render(<Thread user={me} profileMinimumLength={0} />);
    const editor = await screen.findByRole('textbox');

    expect(readKeyboardInset()).toBe('0px');

    editor.focus();
    fireEvent.focusIn(editor);
    expect(readKeyboardInset()).toBe(expectedKeyboardInset(500.4, 20.2));

    // Opening a native text menu must not move the composer while the
    // keyboard still occupies the same part of the visual viewport.
    editor.blur();
    fireEvent.contextMenu(editor);
    expect(readKeyboardInset()).toBe(expectedKeyboardInset(500.4, 20.2));

    visualViewport.height = 550.4;
    viewportListeners.scroll();
    expect(readKeyboardInset()).toBe(expectedKeyboardInset(550.4, 20.2));

    visualViewport.height = windowHeight + 30;
    viewportListeners.resize();
    expect(readKeyboardInset()).toBe('0px');

    const button = screen.getByRole('button', { name: 'Yes, I can host!' });
    button.focus();
    fireEvent.focusOut(editor);
    expect(readKeyboardInset()).toBe('0px');

    unmount();
    expect(visualViewport.removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    );
    expect(readKeyboardInset()).toBe('');
  });

  it('shows the activation prompt and skips loading for private users', () => {
    render(<Thread user={{ ...me, public: false }} profileMinimumLength={0} />);

    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Sorry, you need to first activate your profile by confirming your email.',
    );
    expect(api.users.fetch).not.toHaveBeenCalled();
    expect(api.messages.fetchMessages).not.toHaveBeenCalled();
    expect(analytics.track).toHaveBeenCalledWith('message_gate_shown', {
      reason: 'not_public',
    });
  });

  describe('no messages', () => {
    it.each([
      [
        'Fictional <Member>',
        'fictional-member',
        "You haven't been talking with Fictional <Member> yet.",
      ],
      [
        '',
        'fictional-member',
        "You haven't been talking with fictional-member yet.",
      ],
      [null, null, "You haven't been talking yet."],
    ])(
      'names an empty conversation with safe fallbacks: %s / %s',
      async (displayName, username, heading) => {
        api.users.fetch.mockResolvedValueOnce({
          ...otherUser,
          // Keep the API regression payload whose name fields are explicitly null.
          displayName: displayName as UserProfile['displayName'],
          username: username as UserProfile['username'],
        });
        render(<Thread user={me} profileMinimumLength={0} />);
        expect(
          await screen.findByRole('heading', { name: heading }),
        ).toBeInTheDocument();
      },
    );

    beforeEach(() => {
      api.messages.fetchMessages.mockResolvedValueOnce({ messages: [] });
    });

    it('does not allow sending a message when the profile is too short', async () => {
      const { findByText, queryByRole } = render(
        <Thread user={me} profileMinimumLength={9999} />,
      );
      await findByText(/Your profile seems quite empty/);
      expect(queryByRole('textbox')).not.toBeInTheDocument();
      expect(analytics.track).toHaveBeenCalledWith('message_gate_shown', {
        reason: 'profile_too_short',
      });
      expect(api.users.fetch).toHaveBeenCalledWith(otherUser.username);
      expect(api.messages.fetchMessages).toHaveBeenCalledWith(otherUser._id);
    });

    it('shows reply box if profile is long enough', async () => {
      const { findByRole, queryByText } = render(
        <Thread user={me} profileMinimumLength={0} />,
      );
      const form = await findByRole('form');
      expect(
        queryByText(
          `You haven't been talking with ${
            otherUser.displayName || otherUser.username
          } yet.`,
        ),
      ).toBeInTheDocument();
      expect(within(form).queryByRole('textbox')).toBeInTheDocument();
      expect(screen.queryByTestId('quick-reply')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'safety tips' })).toHaveAttribute(
        'href',
        '/safety',
      );
      expect(
        screen.getByRole('link', { name: 'community rules' }),
      ).toHaveAttribute('href', '/rules');
    });

    it('focuses the reply editor when a conversation opens on desktop', async () => {
      mockIsExtraSmall = false;
      render(<Thread user={me} profileMinimumLength={0} />);

      const editor = await screen.findByRole('textbox');
      await waitFor(() => expect(editor).toHaveFocus());
    });

    it('sends a typed reply and appends the API response to the thread', async () => {
      // The component consumes only AxiosResponse.data in this mock.
      api.messages.sendMessage.mockResolvedValueOnce({
        data: {
          ...createMessage(me),
          _id: 'sent-message',
          content: '<p>Hello, can I stay next Tuesday?</p>',
          created: '2026-06-05T12:00:00.000Z',
        },
      } as Awaited<ReturnType<typeof messagesAPI.sendMessage>>);

      render(<Thread user={me} profileMinimumLength={0} />);

      const editor = await screen.findByRole('textbox');
      expect(editor).toBeInTheDocument();
      fireEvent.change(editor, {
        target: { value: '<p>Hello, can I stay next Tuesday?</p>' },
      });
      const replyForm = editor.closest('form');
      expect(replyForm).toBeTruthy();
      fireEvent.submit(replyForm!);

      await waitFor(() =>
        expect(api.messages.sendMessage).toHaveBeenCalledWith(
          otherUser._id,
          '<p>Hello, can I stay next Tuesday?</p>',
        ),
      );
      expect(
        await screen.findByText('Hello, can I stay next Tuesday?'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/You haven't been talking with/),
      ).not.toBeInTheDocument();
      expect(analytics.track).toHaveBeenCalledWith('message_sent', {
        kind: 'first',
        via: 'editor',
        source: 'other',
      });
      expect(analytics.track).not.toHaveBeenCalledWith(
        'message_gate_shown',
        expect.anything(),
      );
    });

    it('says where reaching out started on a first message', async () => {
      rememberOutreachSource(otherUser.username, 'search');
      api.messages.sendMessage.mockResolvedValueOnce({
        data: { ...createMessage(me), _id: 'first-message' },
      } as Awaited<ReturnType<typeof messagesAPI.sendMessage>>);

      render(<Thread user={me} profileMinimumLength={0} />);
      const editor = await screen.findByRole('textbox');
      fireEvent.change(editor, { target: { value: '<p>Hello!</p>' } });
      fireEvent.submit(editor.closest('form')!);

      await waitFor(() =>
        expect(analytics.track).toHaveBeenCalledWith('message_sent', {
          kind: 'first',
          via: 'editor',
          source: 'search',
        }),
      );
      window.sessionStorage.clear();
    });

    it('tracks an opened thread without unread messages', async () => {
      render(<Thread user={me} profileMinimumLength={0} />);
      await screen.findByRole('form');
      expect(analytics.track).toHaveBeenCalledWith('message_thread_opened', {
        unread: 'no',
      });
      expect(analytics.track).toHaveBeenCalledTimes(1);
    });
  });

  it('redirects to inbox when opening own profile thread', async () => {
    routeParams = {
      username: 'test-member',
    };
    showThread(routeParams);
    api.messages.fetchMessages.mockResolvedValueOnce({ messages: [] });

    // Like the router, leaving the thread route unmounts the thread.
    function ThreadRoute() {
      const { username } = useParams({ strict: false });
      return username ? <Thread user={me} profileMinimumLength={0} /> : null;
    }
    render(<ThreadRoute />);

    await waitFor(() => expect(window.location.pathname).toBe('/messages'));
    expect(
      screen.queryByText(/You haven't been talking yet/),
    ).not.toBeInTheDocument();
  });

  it('shows a safety warning above messages', async () => {
    api.messages.fetchMessages.mockResolvedValueOnce({
      messages: [createMessage(otherUser)],
    });

    render(<Thread user={me} profileMinimumLength={0} />);

    expect(
      await screen.findByText(
        'Trustroots will never ask you for your ID, credit card details, or payment of any kind.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'safety tips' })).toHaveAttribute(
      'href',
      '/safety',
    );
    expect(
      screen.getByRole('link', { name: 'community rules' }),
    ).toHaveAttribute('href', '/rules');
  });

  it('shows removed user note when user has been deleted and userId exists', async () => {
    routeParams = {
      username: otherUser.username,
      userId: otherUser._id,
    };
    showThread(routeParams);

    api.users.fetch.mockRejectedValueOnce({
      response: {
        status: 404,
      },
    });
    api.messages.fetchMessages.mockResolvedValueOnce({ messages: [] });

    render(<Thread user={me} profileMinimumLength={0} />);

    await waitFor(() =>
      expect(
        screen.getByText('Member is not available anymore.'),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('shows missing-member message when deleted user cannot be identified', async () => {
    api.users.fetch.mockRejectedValueOnce({
      response: {
        status: 404,
      },
    });

    render(<Thread user={me} profileMinimumLength={0} />);

    expect(
      await screen.findByText("This user isn't a member anymore."),
    ).toBeInTheDocument();
    expect(api.messages.fetchMessages).not.toHaveBeenCalled();
  });

  it('shows a load failure when member lookup fails unexpectedly', async () => {
    api.users.fetch.mockRejectedValueOnce({
      response: {
        status: 500,
      },
    });

    render(<Thread user={me} profileMinimumLength={0} />);

    expect(
      await screen.findByText('Failed to load messages. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(api.messages.fetchMessages).not.toHaveBeenCalled();
  });

  it('shows a load failure when fetching the conversation fails', async () => {
    api.messages.fetchMessages.mockRejectedValueOnce(new Error('offline'));

    render(<Thread user={me} profileMinimumLength={0} />);

    expect(
      await screen.findByText('Failed to load messages. Please try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('repairs missing message endpoints for removed users', async () => {
    routeParams = {
      username: otherUser.username,
      userId: otherUser._id,
    };
    showThread(routeParams);

    api.users.fetch.mockRejectedValueOnce({
      response: {
        status: 404,
      },
    });
    const removedMessage = malformedFixture(createMessage(otherUser), {
      _id: 'removed-user-message',
      content: 'I used to be here',
      // Deleted-member endpoints may be missing in historical message data.
      userFrom: null,
      userTo: null,
    });
    resolveMalformed(api.messages.fetchMessages, {
      messages: [removedMessage],
    });

    render(<Thread user={me} profileMinimumLength={0} />);

    expect(await screen.findByText('I used to be here')).toBeInTheDocument();
    expect(
      screen.getByText('Member is not available anymore.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(api.messages.markRead).toHaveBeenCalledWith([
        'removed-user-message',
      ]),
    );
  });

  it('keeps existing message endpoints for removed users', async () => {
    routeParams = {
      username: otherUser.username,
      userId: otherUser._id,
    };
    showThread(routeParams);

    api.users.fetch.mockRejectedValueOnce({
      response: {
        status: 404,
      },
    });
    api.messages.fetchMessages.mockResolvedValueOnce({
      messages: [
        {
          ...createMessage(otherUser),
          _id: 'removed-user-complete-message',
          content: 'My endpoints were complete',
          userFrom: { _id: otherUser._id },
          userTo: { _id: me._id },
        },
      ],
    });

    render(<Thread user={me} profileMinimumLength={0} />);

    expect(
      await screen.findByText('My endpoints were complete'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Member is not available anymore.'),
    ).toBeInTheDocument();
  });

  it('shows blocked banner and disables replies for blocked users', async () => {
    const blockedMe = {
      ...me,
      blocked: [otherUser._id],
    };

    api.messages.fetchMessages.mockResolvedValueOnce({
      messages: [
        {
          ...createMessage(otherUser),
          _id: 'blocked-msg',
        },
      ],
    });

    render(<Thread user={blockedMe} profileMinimumLength={0} />);

    const blockedAlert = await screen.findByRole('alert');

    expect(blockedAlert).toHaveTextContent('You have blocked this member.');
    expect(
      screen.queryByRole('button', { name: 'Send' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('shows a loading indicator while fetching the next page of older messages', async () => {
    const newestMessage = {
      ...createMessage(otherUser),
      _id: 'newest-message',
      content: 'Newest message',
      created: '2026-06-05T12:00:00.000Z',
      read: true,
    };
    const oldestMessage = {
      ...createMessage(otherUser),
      _id: 'oldest-message',
      content: 'Oldest message',
      created: '2026-06-04T12:00:00.000Z',
      read: true,
    };
    let finishOlderPage!: (page: { messages: Message[] }) => void;
    const olderPage = new Promise<{ messages: Message[] }>(resolve => {
      finishOlderPage = resolve;
    });
    api.messages.fetchMessages
      .mockResolvedValueOnce({
        messages: [newestMessage],
        nextParams: { before: 'older-page' },
      })
      .mockReturnValueOnce(olderPage);
    resolveMalformed(api.messages.fetchMessages, {
      messages: [oldestMessage],
      // The API uses null to represent the end of pagination.
      nextParams: null,
    });

    render(<Thread user={me} profileMinimumLength={0} />);

    const message = await screen.findByText('Newest message');
    fireEvent.scroll(message.closest('.thread-messages')!);

    const loading = await screen.findByRole('alertdialog');
    expect(api.messages.fetchMessages).toHaveBeenLastCalledWith(otherUser._id, {
      before: 'older-page',
    });
    await act(async () => finishOlderPage({ messages: [oldestMessage] }));
    expect(await screen.findByText('Oldest message')).toBeInTheDocument();
    expect(loading).not.toBeInTheDocument();
  });

  it('prepends older paginated messages in chronological order', async () => {
    const newestMessage = {
      ...createMessage(otherUser),
      _id: 'newest-message',
      content: 'Newest message',
      created: '2026-06-05T12:00:00.000Z',
      read: true,
    };
    const oldestMessage = {
      ...createMessage(otherUser),
      _id: 'oldest-message',
      content: 'Oldest message',
      created: '2026-06-03T12:00:00.000Z',
      read: true,
    };
    const middleMessage = {
      ...createMessage(otherUser),
      _id: 'middle-message',
      content: 'Middle message',
      created: '2026-06-04T12:00:00.000Z',
      read: true,
    };
    api.messages.fetchMessages
      .mockResolvedValueOnce({
        messages: [newestMessage],
        nextParams: { before: 'older-page' },
      })
      .mockResolvedValueOnce({
        messages: [middleMessage, oldestMessage],
      });
    resolveMalformed(api.messages.fetchMessages, {
      messages: [middleMessage, oldestMessage],
      // The API uses null to represent the end of pagination.
      nextParams: null,
    });

    render(<Thread user={me} profileMinimumLength={0} />);

    const message = await screen.findByText('Newest message');
    fireEvent.scroll(message.closest('.thread-messages')!);

    await screen.findByText('Middle message');
    const messages = screen.getAllByText(/message$/i);
    expect(messages.map(message => message.textContent)).toEqual([
      'Oldest message',
      'Middle message',
      'Newest message',
    ]);
  });

  it('does not fetch older messages when no next pagination params exist', async () => {
    resolveMalformed(api.messages.fetchMessages, {
      messages: [
        {
          ...createMessage(otherUser),
          _id: 'only-message',
          content: 'Only message',
          created: new Date().toISOString(),
        },
      ],
      // The API uses null to represent the end of pagination.
      nextParams: null,
    });

    render(<Thread user={me} profileMinimumLength={0} />);

    const message = await screen.findByText('Only message');
    vi.useFakeTimers();
    try {
      fireEvent.scroll(message.closest('.thread-messages')!);
      act(() => vi.runOnlyPendingTimers());
      expect(api.messages.fetchMessages).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('displays an explicit rate-limit alert when send fails with 429', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    api.messages.fetchMessages.mockResolvedValueOnce({ messages: [] });
    api.messages.sendMessage.mockRejectedValueOnce({
      response: { status: 429 },
    });

    render(<Thread user={me} profileMinimumLength={0} />);
    const editor = await screen.findByRole('textbox');
    expect(editor).toBeInTheDocument();

    fireEvent.change(editor, {
      target: {
        value: '<p>Can I host this week?</p>',
      },
    });
    const replyForm = editor.closest('form');
    expect(replyForm).toBeTruthy();
    fireEvent.submit(replyForm!);

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'You are writing to too many people too fast. Slow down and try later again.',
      ),
    );
    expect(analytics.track).toHaveBeenCalledWith('message_send_failed', {
      reason: 'rate_limited',
    });
  });

  it('displays a generic alert when send fails without a rate limit', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    api.messages.fetchMessages.mockResolvedValueOnce({ messages: [] });
    api.messages.sendMessage.mockRejectedValueOnce({
      response: { status: 500 },
    });

    render(<Thread user={me} profileMinimumLength={0} />);
    const editor = await screen.findByRole('textbox');

    fireEvent.change(editor, {
      target: {
        value: '<p>Can I host this week?</p>',
      },
    });
    const replyForm = editor.closest('form');
    expect(replyForm).toBeTruthy();
    fireEvent.submit(replyForm!);

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'Failed to send the message. Perhaps your internet went down? Please try again.',
      ),
    );
    expect(analytics.track).toHaveBeenCalledWith('message_send_failed', {
      reason: 'other',
    });
    expect(analytics.track).not.toHaveBeenCalledWith(
      'message_sent',
      expect.anything(),
    );
  });

  it('shows sidebar actions and references on wider screens', async () => {
    mockIsExtraSmall = false;
    api.messages.fetchMessages.mockResolvedValueOnce({
      messages: [
        {
          ...createMessage(otherUser),
          _id: 'sidebar-message',
          content: 'Message with sidebar',
          read: true,
        },
      ],
    });

    render(<Thread user={me} profileMinimumLength={0} />);

    expect(await screen.findByTestId('monkeybox')).toBeInTheDocument();
    expect(
      screen.getByText(`References for ${otherUser._id}`),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Report ${otherUser.username}` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Block ${otherUser.username}` }),
    ).toBeInTheDocument();
  });

  describe('only messages from other user', () => {
    beforeEach(() => {
      api.messages.fetchMessages.mockResolvedValueOnce({
        messages: [createMessage(otherUser, { hostingDetails: { guests: 1 } })],
      });
    });

    it('shows quick reply buttons', async () => {
      render(<Thread user={me} profileMinimumLength={0} />);
      const quickReply = await screen.findByTestId('quick-reply');
      const buttons = within(quickReply).queryAllByRole('button');
      expect(buttons.length).toBe(3);
      ['Yes, I can host!', "Sorry I can't host", 'Write back'].forEach(
        (content, i) => {
          expect(buttons[i]).toHaveTextContent(content);
        },
      );
    });

    it('keeps shortcuts visible when an ordinary incoming message follows a hosting message', async () => {
      api.messages.fetchMessages.mockReset().mockResolvedValueOnce({
        messages: [
          createMessage(otherUser, {
            created: '2026-06-05T12:00:00.000Z',
            hostingDetails: { guests: 1 },
          }),
          createMessage(otherUser, {
            created: '2026-06-06T12:00:00.000Z',
          }),
        ],
      });
      render(<Thread user={me} profileMinimumLength={0} />);
      expect(await screen.findByTestId('quick-reply')).toBeInTheDocument();
    });

    it('sends a hosting quick reply through the thread API', async () => {
      // The component consumes only AxiosResponse.data in this mock.
      api.messages.sendMessage.mockResolvedValueOnce({
        data: {
          ...createMessage(me),
          _id: 'quick-reply-message',
          content: '<p data-hosting="yes"><b><i>Yes, I can host!</i></b></p>',
          created: new Date().toISOString(),
        },
      } as Awaited<ReturnType<typeof messagesAPI.sendMessage>>);

      render(<Thread user={me} profileMinimumLength={0} />);
      await screen.findByRole('button', { name: 'Yes, I can host!' });

      fireEvent.click(screen.getByRole('button', { name: 'Yes, I can host!' }));

      await waitFor(() =>
        expect(api.messages.sendMessage).toHaveBeenCalledWith(
          otherUser._id,
          expect.stringContaining('data-hosting="yes"'),
        ),
      );
      await waitFor(() =>
        expect(screen.queryByTestId('quick-reply')).not.toBeInTheDocument(),
      );
      expect(screen.getByText('Yes, I can host!')).toBeInTheDocument();
      expect(analytics.track).toHaveBeenCalledWith('message_sent', {
        kind: 'reply',
        via: 'quick_reply',
      });
    });
  });

  describe('unread messages from other user', () => {
    it('marks them read and refreshes the unread message count', async () => {
      const unreadMessage = createMessage(otherUser);
      unreadMessage._id = 'unread-message';
      api.messages.fetchMessages.mockResolvedValueOnce({
        messages: [unreadMessage],
      });

      render(<Thread user={me} profileMinimumLength={0} />);
      await screen.findByRole('textbox');

      await waitFor(() =>
        expect(api.messages.markRead).toHaveBeenCalledWith(['unread-message']),
      );
      expect(updateUnreadCount).toHaveBeenCalledTimes(1);
      expect(analytics.track).toHaveBeenCalledWith('message_thread_opened', {
        unread: 'yes',
      });
    });
  });

  describe('only own unanswered messages', () => {
    it('counts another message as a follow-up, not a reply', async () => {
      api.messages.fetchMessages.mockResolvedValueOnce({
        messages: [createMessage(me)],
      });
      api.messages.sendMessage.mockResolvedValueOnce({
        data: { ...createMessage(me), _id: 'follow-up' },
      } as Awaited<ReturnType<typeof messagesAPI.sendMessage>>);
      render(<Thread user={me} profileMinimumLength={0} />);
      const editor = await screen.findByRole('textbox');
      fireEvent.change(editor, { target: { value: '<p>Any news?</p>' } });
      fireEvent.submit(editor.closest('form')!);

      await waitFor(() =>
        expect(analytics.track).toHaveBeenCalledWith('message_sent', {
          kind: 'followup',
          via: 'editor',
        }),
      );
    });
  });

  describe('messages from both users', () => {
    beforeEach(() => {
      const messageFromOther = createMessage(otherUser, {
        hostingDetails: { guests: 1 },
      });
      messageFromOther.content = 'Hi there from other user';
      messageFromOther.created = '2026-01-01T10:00:00.000Z';
      const messageFromMe = createMessage(me);
      messageFromMe._id = 'my-message';
      messageFromMe.content = 'Hi there from me';
      messageFromMe.created = '2026-01-01T11:00:00.000Z';

      api.messages.fetchMessages.mockResolvedValueOnce({
        messages: [messageFromOther, messageFromMe],
      });
    });

    it('tracks a follow-up after an unanswered reply in an existing thread', async () => {
      api.messages.sendMessage.mockResolvedValueOnce({
        data: { ...createMessage(me), _id: 'typed-reply' },
      } as Awaited<ReturnType<typeof messagesAPI.sendMessage>>);
      render(<Thread user={me} profileMinimumLength={0} />);
      const editor = await screen.findByRole('textbox');
      fireEvent.change(editor, { target: { value: '<p>Thanks!</p>' } });
      fireEvent.submit(editor.closest('form')!);

      await waitFor(() =>
        expect(analytics.track).toHaveBeenCalledWith('message_sent', {
          kind: 'followup',
          via: 'editor',
        }),
      );
    });

    it('does not show the quick reply buttons', async () => {
      const { queryByTestId } = render(
        <Thread user={me} profileMinimumLength={0} />,
      );
      await screen.findByText('Hi there from me');

      await waitFor(() => {
        expect(queryByTestId('quick-reply')).not.toBeInTheDocument();
      });
    });
  });
});
