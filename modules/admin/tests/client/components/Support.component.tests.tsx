import React from 'react';
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import SupportInbox, {
  SupportMemberPage,
  SupportMemberSearchPage,
} from '../../../client/components/Support.component';
import * as api from '../../../client/api/support.api';
import type { SupportRequest } from '../../../client/api/support.api';

jest.mock('../../../client/api/support.api', () => ({
  load: jest.fn(),
  setStatus: jest.fn(),
  listRequests: jest.fn(),
  loadConversation: jest.fn(),
  sendReply: jest.fn(),
  retryReply: jest.fn(),
}));
jest.mock(
  '../../../client/components/AdminHeader.component',
  () =>
    function Header() {
      return <nav>Staff navigation</nav>;
    },
);
jest.mock(
  '../../../client/components/AdminNotes',
  () =>
    function Notes({ id }: { id: string }) {
      return <div>Notes for {id}</div>;
    },
);

const load = jest.mocked(api.load);
const setStatus = jest.mocked(api.setStatus);
const listRequests = jest.mocked(api.listRequests);
const loadConversation = jest.mocked(api.loadConversation);
const sendReply = jest.mocked(api.sendReply);
const retryReply = jest.mocked(api.retryReply);
const report = {
  _id: 'report-1',
  category: 'reportMember',
  user: 'reporter-1',
  reportedUser: 'target-1',
  username: 'fictional-reporter',
  reportMember: 'fictional-target',
  email: 'reporter@example.test',
  sent: '2026-01-02T12:00:00Z',
  message: 'Fictional safety concern.',
  status: 'open',
};
const member = {
  _id: 'target-1',
  username: 'fictional-target',
  displayName: 'Fictional Member',
  roles: ['user', 'suspended', 'shadowban'],
  public: false,
  email: 'member@example.test',
  emailTemporary: 'member@example.test',
  pendingDeletion: true,
  description: '<p>Profile text</p>',
  locationLiving: 'Fictional place',
  locationFrom: 'Fictional origin',
  languages: ['eng'],
};

beforeEach(() => {
  jest.resetAllMocks();
  setStatus.mockResolvedValue(undefined);
  listRequests.mockImplementation(async filters => {
    const query = new URLSearchParams({
      status: filters.status,
      page: String(filters.page),
    });
    if (filters.category) query.set('category', filters.category);
    if (filters.q) query.set('q', filters.q);
    const value = (await load(`/api/admin/support?${query.toString()}`)) as {
      items: SupportRequest[];
      page?: number;
      hasMore?: boolean;
      total?: number;
      matchingTotal?: number;
      unconfirmedCount?: number;
      statusCounts?: Record<string, number>;
    };
    return {
      ...value,
      page: value.page || filters.page,
      hasMore: Boolean(value.hasMore),
      total: value.total ?? value.items?.length ?? 0,
      matchingTotal: value.matchingTotal ?? value.items?.length ?? 0,
      statusCounts: {
        new: 0,
        open: 0,
        pending: 0,
        hold: 0,
        solved: 0,
        closed: 0,
        ...value.statusCounts,
      },
      ...(value.unconfirmedCount !== undefined
        ? { unconfirmedCount: value.unconfirmedCount }
        : {}),
    };
  });
  loadConversation.mockResolvedValue({
    items: [
      {
        _id: 'initial-report-1',
        request: 'report-1',
        direction: 'inbound',
        kind: 'initial',
        body: report.message,
        createdAt: report.sent,
        deliveryState: 'received',
      },
    ],
    page: 1,
    hasMore: false,
  });
  sendReply.mockResolvedValue({
    _id: 'reply-1',
    request: 'report-1',
    direction: 'outbound',
    kind: 'reply',
    body: 'Fictional response',
    createdAt: report.sent,
    authorName: 'Fictional Support',
    deliveryState: 'queued',
  });
  retryReply.mockResolvedValue({
    _id: 'reply-1',
    request: 'report-1',
    direction: 'outbound',
    kind: 'reply',
    body: 'Fictional response',
    createdAt: report.sent,
    authorName: 'Fictional Support',
    deliveryState: 'queued',
  });
  window.history.replaceState({}, '', '/admin/support');
});
afterEach(() => {
  delete window.user;
});

test('triages a report and reads its whole conversation and unpublished experiences', async () => {
  let resolved = false;
  load.mockImplementation(async path => {
    if (path.includes('/messages'))
      return {
        items: [
          {
            _id: 'message',
            created: report.sent,
            userFrom: { username: 'fictional-target' },
            userTo: null,
            content: '<p>Hidden context</p>',
            shadowHidden: true,
          },
        ],
        hasMore: false,
      };
    if (path.includes('/experiences'))
      return {
        items: [
          {
            _id: 'experience',
            created: report.sent,
            userFrom: null,
            userTo: { username: 'fictional-reporter' },
            feedbackPublic: 'Unpublished feedback',
            recommend: 'no',
            public: false,
          },
        ],
        hasMore: false,
      };
    if (path === '/api/admin/support/report-1')
      return {
        ...report,
        status: resolved ? 'resolved' : 'open',
        subject: 'Fictional support subject',
        lastActivityAt: report.sent,
      };
    return { items: [report], hasMore: true };
  });
  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  expect(await screen.findByText(report.message)).toBeInTheDocument();
  expect(screen.getByText('Fictional support subject')).toBeInTheDocument();
  expect(screen.getByText('Last activity')).toBeInTheDocument();
  const queue = screen.getByRole('region', { name: 'Request queue' });
  expect(
    within(queue).getByRole('button', { name: /fictional-reporter/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  const details = screen.getByRole('region', { name: 'Support request' });
  expect(within(details).getByText(report.email)).toBeInTheDocument();
  expect(within(details).getByText('Received')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Reported account and notes' }),
  ).toHaveAttribute('href', '/admin/support/member/target-1');
  fireEvent.click(screen.getByRole('button', { name: 'View conversation' }));
  expect(await screen.findByText('Hidden context')).toBeInTheDocument();
  expect(screen.getByText('Hidden message')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View experiences' }));
  expect(await screen.findByText('Unpublished feedback')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'View experiences' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(
    screen.getByRole('button', { name: 'View conversation' }),
  ).toHaveAttribute('aria-pressed', 'false');
  expect(
    screen.getByText('Unpublished · Recommendation: no'),
  ).toBeInTheDocument();
  resolved = true;
  fireEvent.click(screen.getByRole('button', { name: 'Mark solved' }));
  await screen.findByRole('button', { name: 'Reopen request' });
  expect(setStatus).toHaveBeenCalledWith('report-1', 'solved');
  resolved = false;
  fireEvent.click(screen.getByRole('button', { name: 'Reopen request' }));
  await screen.findByRole('button', { name: 'Mark solved' });
  expect(setStatus).toHaveBeenCalledWith('report-1', 'open');
  fireEvent.click(screen.getAllByRole('button', { name: 'Next' })[0]);
  await waitFor(() =>
    expect(load).toHaveBeenCalledWith(
      '/api/admin/support?status=unresolved&page=2',
    ),
  );
  fireEvent.click(
    await within(queue).findByRole('button', { name: 'Previous' }),
  );
  fireEvent.change(document.getElementById('support-status')!, {
    target: { value: 'solved' },
  });
  fireEvent.change(screen.getByLabelText('Category'), {
    target: { value: 'reportMember' },
  });
  await waitFor(() =>
    expect(load).toHaveBeenCalledWith(
      '/api/admin/support?status=solved&page=1&category=reportMember',
    ),
  );
});

test('shows linked account roles and renders support dates in UTC', async () => {
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') return report;
    if (path === '/api/admin/support/report-1/messages?page=1')
      return {
        items: [
          {
            _id: 'message-1',
            created: report.sent,
            userFrom: { username: 'fictional-target' },
            userTo: { username: 'fictional-reporter' },
            content: 'Fictional conversation text',
          },
        ],
        hasMore: false,
      };
    if (path === '/api/admin/support-members/reporter-1')
      return {
        ...member,
        _id: 'reporter-1',
        username: 'renamed-current-reporter',
        roles: ['user', 'admin', 'support-team', 'welcome-team'],
      };
    if (path === '/api/admin/support-members/target-1')
      return { ...member, username: 'renamed-current-target' };
    return { items: [report], hasMore: false };
  });
  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  await waitFor(() =>
    expect(screen.getAllByText('2026-01-02 12:00')).toHaveLength(2),
  );
  await screen.findByText('admin', { exact: true });
  expect(
    screen.getByRole('group', { name: 'Reporter account status' }),
  ).toHaveTextContent('admin');
  expect(
    screen.getByRole('group', { name: 'Reporter account status' }),
  ).toHaveTextContent('Support team');
  expect(
    screen.getByRole('group', { name: 'Reporter account status' }),
  ).toHaveTextContent('Greeter');
  expect(
    await screen.findByText('suspended', { exact: true }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('group', { name: 'Reported member account status' }),
  ).toHaveTextContent('shadowban');
  const details = screen.getByRole('region', { name: 'Support request' });
  expect(
    within(details).getAllByRole('link', { name: 'fictional-reporter' })[0],
  ).toHaveAttribute('href', '/admin/user/fictional-reporter');
  expect(
    within(details).getByRole('link', { name: 'fictional-target' }),
  ).toHaveAttribute('href', '/admin/user/fictional-target');
  expect(
    screen.getByRole('link', { name: 'Reporter account and notes' }),
  ).toHaveAttribute('href', '/admin/support/member/renamed-current-reporter');
  expect(
    screen.getByRole('link', { name: 'Reported account and notes' }),
  ).toHaveAttribute('href', '/admin/support/member/renamed-current-target');
  fireEvent.click(screen.getByRole('button', { name: 'View conversation' }));
  await waitFor(() =>
    expect(screen.getAllByText('2026-01-02 12:00')).toHaveLength(3),
  );
});

test('links the original request sender to their admin user page', async () => {
  const username = 'fictional/reporter name';
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') return { ...report, username };
    return { items: [report], hasMore: false };
  });
  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );

  const conversation = await screen.findByRole('region', {
    name: 'Support conversation',
  });
  const senderLink = await within(conversation).findByRole('link', {
    name: username,
  });
  expect(senderLink).toHaveAttribute(
    'href',
    '/admin/user/fictional%2Freporter%20name',
  );
  expect(senderLink.closest('strong')).not.toBeNull();
  expect(
    within(conversation).getByText('2026-01-02 12:00'),
  ).toBeInTheDocument();
});

test('retries failed case status and falls back to the reporter id link', async () => {
  let reporterAttempts = 0;
  let failReporterLookup: ((error: Error) => void) | undefined;
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1')
      return { ...report, username: undefined };
    if (path === '/api/admin/support-members/reporter-1') {
      reporterAttempts += 1;
      if (reporterAttempts === 1)
        return new Promise((_, reject) => {
          failReporterLookup = reject;
        });
      return { ...member, _id: 'reporter-1', username: 'fictional-reporter' };
    }
    if (path === '/api/admin/support-members/target-1') return member;
    return { items: [{ ...report, username: undefined }], hasMore: false };
  });

  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /reporter@example\.test · Report a member/,
    }),
  );
  const conversation = await screen.findByRole('region', {
    name: 'Support conversation',
  });
  expect(
    await within(conversation).findByText('reporter@example.test', {
      selector: 'strong',
    }),
  ).toBeInTheDocument();
  expect(
    within(conversation).queryByRole('link', {
      name: 'reporter@example.test',
    }),
  ).not.toBeInTheDocument();
  const reporterStatus = await screen.findByRole('group', {
    name: 'Reporter account status',
  });
  expect(
    within(reporterStatus).getByRole('link', {
      name: 'Reporter account and notes',
    }),
  ).toHaveAttribute('href', '/admin/support/member/reporter-1');
  await act(async () => failReporterLookup?.(new Error('Unavailable')));
  await within(reporterStatus).findByText('Account status unavailable.');
  expect(
    screen.getByRole('link', { name: 'Reporter account and notes' }),
  ).toHaveAttribute('href', '/admin/support/member/reporter-1');

  fireEvent.click(
    within(reporterStatus).getByRole('button', { name: 'Retry' }),
  );
  await within(reporterStatus).findByText('suspended');
  expect(reporterAttempts).toBe(2);
  expect(
    within(reporterStatus).getByRole('link', {
      name: 'Reporter account and notes',
    }),
  ).toHaveAttribute('href', '/admin/support/member/fictional-reporter');
});

test('canonicalizes legacy member IDs and ignores a stale member response', async () => {
  window.history.pushState({}, '', '/admin/support/member/legacy-id');
  load.mockResolvedValue({ ...member, _id: 'legacy-id' });
  render(<SupportMemberPage id="legacy-id" />);
  await screen.findByText('Notes for legacy-id');
  await waitFor(() =>
    expect(window.location.pathname).toBe(
      '/admin/support/member/fictional-target',
    ),
  );

  let resolveRequest: (value: typeof member) => void = () => {};
  load.mockImplementation(
    () =>
      new Promise(resolve => {
        resolveRequest = resolve;
      }),
  );
  window.history.pushState({}, '', '/admin/support/member/stale-id');
  const view = render(<SupportMemberPage id="stale-id" />);
  view.unmount();
  window.history.pushState({}, '', '/admin/support');
  await act(async () => {
    resolveRequest(member);
  });
  expect(window.location.pathname).toBe('/admin/support');
});

test('handles missing verified member linkage', async () => {
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1')
      return {
        ...report,
        reportedUser: undefined,
        user: undefined,
        username: undefined,
        status: undefined,
        statusProvenance: 'missing',
      };
    return {
      items: [
        {
          ...report,
          username: undefined,
          status: undefined,
          statusProvenance: 'missing',
        },
      ],
      hasMore: false,
    };
  });
  render(<SupportInbox />);
  const queue = screen.getByRole('region', { name: 'Request queue' });
  const queueItem = await within(queue).findByRole('button', {
    name: /reporter@example.test · Report a member/,
  });
  expect(
    within(queueItem).getByText('Unconfirmed legacy status'),
  ).toBeVisible();
  expect(
    screen.queryByRole('region', { name: 'Member search' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    await screen.findByRole('button', {
      name: /reporter@example.test · Report a member/,
    }),
  );
  const details = await screen.findByRole('region', {
    name: 'Support request',
  });
  expect(within(details).getByText('Unconfirmed legacy status')).toBeVisible();
  expect(
    await screen.findByText(/No verified member pair/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'View conversation' }),
  ).not.toBeInTheDocument();
});

test('searches for members on the dedicated support page', async () => {
  load.mockImplementation(async path => {
    if (path.startsWith('/api/admin/support-members')) return [member];
    return { items: [], hasMore: false };
  });
  render(<SupportMemberSearchPage />);
  expect(
    screen.getByRole('heading', { name: 'Member search', level: 1 }),
  ).toBeInTheDocument();
  const search = screen.getByRole('region', { name: 'Member search' });
  fireEvent.change(screen.getByLabelText('Name, username or email'), {
    target: { value: 'fictional' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Search members' }));
  expect(
    await within(search).findByRole('link', {
      name: 'fictional-target (Fictional Member)',
    }),
  ).toHaveAttribute('href', '/admin/support/member/fictional-target');
  load.mockResolvedValueOnce({ unexpected: true });
  fireEvent.click(screen.getByRole('button', { name: 'Search members' }));
  expect(
    await within(search).findByText('No members found.'),
  ).toBeInTheDocument();
  expect(
    within(search).queryByRole('link', {
      name: 'fictional-target (Fictional Member)',
    }),
  ).not.toBeInTheDocument();
  load.mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button', { name: 'Search members' }));
  await within(search).findByText('No members found.');
  load.mockRejectedValue(new Error('Unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Search members' }));
  await within(search).findByRole('alert');
});

test('shows recoverable inbox and investigation failures and failed status changes', async () => {
  load.mockRejectedValue(new Error('Unavailable'));
  render(<SupportInbox />);
  await screen.findByRole('alert');
  load.mockImplementation(async path => {
    if (path.includes('/messages')) throw new Error('Unavailable');
    if (path === '/api/admin/support/report-1') return report;
    return { items: [report], hasMore: false };
  });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'View conversation' }),
  );
  await screen.findByRole('alert');
  load.mockResolvedValue({ items: [], hasMore: false });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('No messages found.');
  setStatus.mockRejectedValue(new Error('Unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Mark solved' }));
  await screen.findByText('Unable to update this request. Please try again.');
});

test('renders empty inbox and request detail errors without stale content', async () => {
  load.mockResolvedValue({ items: [], hasMore: false });
  const view = render(<SupportInbox />);
  await screen.findByText('No support requests match these filters.');
  view.unmount();
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') throw new Error('Unavailable');
    return { items: [report], hasMore: false };
  });
  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  await screen.findByRole('alert');
});

test('shows safe restricted account information and member notes', async () => {
  window.user = { roles: ['admin'] };
  load.mockResolvedValue(member);
  render(<SupportMemberPage id="target-1" />);
  await screen.findByRole('heading', {
    name: 'fictional-target (Fictional Member)',
  });
  expect(screen.getByText('suspended')).toBeInTheDocument();
  expect(screen.getByText('shadowban')).toBeInTheDocument();
  expect(screen.getByText('Pending deletion')).toBeInTheDocument();
  expect(screen.getByText('Profile text')).toBeInTheDocument();
  expect(screen.getByText('Notes for target-1')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'fictional-target (Fictional Member)' }),
  ).toHaveAttribute('href', '/admin/user/fictional-target');
});

test('handles deleted accounts and missing optional member fields', async () => {
  load.mockRejectedValue(new Error('Not found'));
  const view = render(<SupportMemberPage id="missing" />);
  await screen.findByRole('alert');
  view.unmount();
  load.mockResolvedValue({
    ...member,
    languages: undefined,
    pendingDeletion: false,
  });
  render(<SupportMemberPage id="target-1" />);
  await screen.findByText('Notes for target-1');
  expect(screen.queryByText('Pending deletion')).not.toBeInTheDocument();
});

test('ignores a failed request after unmounting', async () => {
  let rejectRequest: (reason: Error) => void = () => {};
  load.mockImplementation(
    () =>
      new Promise((resolve, reject) => {
        rejectRequest = reject;
      }),
  );
  const view = render(<SupportMemberPage id="target-1" />);
  view.unmount();
  await act(async () => {
    rejectRequest(new Error('Late failure'));
  });
});

test('pages backwards and shows published experiences', async () => {
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') return report;
    if (path.includes('/experiences'))
      return {
        items: [
          {
            _id: 'published',
            created: report.sent,
            userFrom: null,
            userTo: null,
            public: true,
            recommend: 'yes',
          },
        ],
        hasMore: false,
      };
    return { items: [report], hasMore: true };
  });
  render(<SupportInbox />);
  await screen.findByRole('button', {
    name: /fictional-reporter · Report a member/,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('button', {
    name: /fictional-reporter · Report a member/,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  await waitFor(() =>
    expect(load).toHaveBeenLastCalledWith(
      '/api/admin/support?status=unresolved&page=1',
    ),
  );
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'View experiences' }),
  );
  await screen.findByText('Published · Recommendation: yes');
});

test('keeps a linked reported account visible when its original username is absent', async () => {
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1')
      return { ...report, reportMember: undefined };
    return { items: [report], hasMore: false };
  });
  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  expect(
    await screen.findByRole('link', { name: 'Reported account and notes' }),
  ).toHaveAttribute('href', '/admin/support/member/target-1');
  expect(
    screen.getByRole('heading', { name: 'Reported member' }),
  ).toBeInTheDocument();
});

test('deep-links a request while retaining all active filters and count ranges', async () => {
  window.history.replaceState(
    {},
    '',
    '/admin/support?status=pending&category=reportMember&page=2&q=literal%20term',
  );
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') return report;
    return {
      items: [{ ...report, subject: 'Fictional queue subject' }],
      page: 2,
      hasMore: false,
      total: 104,
      matchingTotal: 52,
      statusCounts: {
        new: 4,
        open: 12,
        pending: 7,
        hold: 2,
        solved: 20,
        closed: 7,
      },
    };
  });
  render(<SupportInbox />);

  await screen.findByText('Showing 51–51 of 52 matching requests (104 total)');
  expect(screen.getByText('Fictional queue subject')).toBeInTheDocument();
  expect(screen.getByLabelText('Search requests')).toHaveValue('literal term');
  expect(screen.getAllByText('Pending')).toHaveLength(2);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  await screen.findByText(report.message);
  expect(window.location.pathname).toBe('/admin/support/requests/report-1');
  expect(window.location.search).toBe(
    '?status=pending&category=reportMember&page=2&q=literal+term',
  );
  fireEvent.change(document.getElementById('support-request-status')!, {
    target: { value: 'hold' },
  });
  await waitFor(() =>
    expect(setStatus).toHaveBeenCalledWith('report-1', 'hold'),
  );
});

test('keeps a failed reply draft, then shows queued text and attachment notices', async () => {
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') return report;
    return { items: [report], hasMore: false };
  });
  loadConversation.mockResolvedValue({
    page: 1,
    hasMore: false,
    items: [
      {
        _id: 'initial-report-1',
        request: 'report-1',
        direction: 'inbound',
        kind: 'initial',
        body: 'Fictional original message',
        createdAt: report.sent,
        deliveryState: 'received',
        attachments: [
          { filename: 'fictional-photo.jpg', size: 2048 },
          { contentType: 'image/png' },
        ],
        oversized: true,
      },
      {
        _id: 'truncated-report-1',
        request: 'report-1',
        direction: 'inbound',
        kind: 'reply',
        body: 'Fictional bounded message',
        createdAt: 'invalid-date',
        deliveryState: 'received',
        truncated: true,
      },
      {
        _id: 'oversized-empty-report-1',
        request: 'report-1',
        direction: 'inbound',
        kind: 'reply',
        body: '',
        createdAt: report.sent,
        deliveryState: 'received',
        oversized: true,
      },
    ],
  });
  sendReply.mockRejectedValueOnce(new Error('Temporary network failure'));
  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  await screen.findByText('Fictional original message');
  expect(screen.getByText('fictional-photo.jpg (2 KB)')).toBeInTheDocument();
  expect(screen.getByText('File')).toBeInTheDocument();
  expect(
    screen.getByText('Original files remain in Zoho.'),
  ).toBeInTheDocument();
  expect(
    screen.getAllByText(/This email exceeded the processing limit/),
  ).toHaveLength(2);
  expect(
    screen.getByText(
      /truncated to fit local storage\. Read the complete email in Zoho/,
    ),
  ).toBeInTheDocument();
  const composer = screen.getByLabelText('Reply to requester');
  fireEvent.change(composer, { target: { value: 'Fictional follow-up' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  await screen.findByText(/Your draft is still here/);
  expect(composer).toHaveValue('Fictional follow-up');
  const firstKey = sendReply.mock.calls[0][2];

  sendReply.mockRejectedValueOnce(new Error('Still unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  await screen.findByText(/Your draft is still here/);
  expect(sendReply.mock.calls[1][2]).toBe(firstKey);
  fireEvent.change(composer, {
    target: { value: 'Fictional follow-up edited' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  await screen.findByText('Fictional response');
  expect(composer).toHaveValue('');
  expect(screen.getByText('Queued')).toBeInTheDocument();
  expect(sendReply).toHaveBeenCalledWith(
    'report-1',
    'Fictional follow-up edited',
    expect.any(String),
  );
  expect(sendReply.mock.calls[2][2]).not.toBe(firstKey);
});

test('requires explicit confirmation before retrying uncertain delivery', async () => {
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') return report;
    return { items: [report], hasMore: false };
  });
  loadConversation.mockResolvedValue({
    page: 1,
    hasMore: false,
    items: [
      {
        _id: 'uncertain-reply',
        request: 'report-1',
        direction: 'outbound',
        kind: 'reply',
        body: 'Fictional reply',
        createdAt: report.sent,
        authorName: 'Fictional Support',
        deliveryState: 'uncertain',
      },
    ],
  });
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Retry delivery' }),
  );
  expect(confirm).toHaveBeenCalled();
  expect(retryReply).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Retry delivery' }));
  await waitFor(() =>
    expect(retryReply).toHaveBeenCalledWith(
      'report-1',
      'uncertain-reply',
      expect.any(String),
      true,
    ),
  );
});

test('loads a direct request URL with legacy status and normalises an invalid page', async () => {
  window.history.replaceState(
    {},
    '',
    '/admin/support/requests/report-1?status=resolved&page=0',
  );
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') return report;
    return { items: [report], hasMore: false };
  });
  render(<SupportInbox requestId="report-1" />);
  await screen.findByText(report.message);
  expect(load).toHaveBeenCalledWith('/api/admin/support?status=solved&page=1');
  expect(document.getElementById('support-status')).toHaveValue('solved');
  window.history.replaceState(
    {},
    '',
    '/admin/support/requests/report-1?status=not-a-status&page=0',
  );
  window.dispatchEvent(new PopStateEvent('popstate'));
  await waitFor(() =>
    expect(load).toHaveBeenCalledWith(
      '/api/admin/support?status=unresolved&page=1',
    ),
  );
  expect(document.getElementById('support-status')).toHaveValue('unresolved');
});

test('keeps a malformed request path from crashing the inbox', async () => {
  window.history.replaceState({}, '', '/admin/support/requests/%E0%A4%A');
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/%E0%A4%A') return report;
    return { items: [report], hasMore: false };
  });
  render(<SupportInbox />);
  expect(await screen.findByText(report.message)).toBeVisible();
});

test('recovers a failed conversation load and pages through chronological messages', async () => {
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') return report;
    return { items: [report], hasMore: false };
  });
  loadConversation
    .mockRejectedValueOnce(new Error('Unavailable'))
    .mockImplementation(async (_id, page) => ({
      page,
      hasMore: true,
      items: [
        {
          _id: `conversation-${page}`,
          request: 'report-1',
          direction: 'inbound',
          kind: 'reply',
          body: `Fictional page ${page}`,
          createdAt: `2026-01-0${page}T12:00:00Z`,
          deliveryState: 'received',
        },
      ],
    }));
  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  await screen.findByText('Unable to load the conversation. Please try again.');
  fireEvent.click(
    within(
      screen.getByRole('region', { name: 'Support conversation' }),
    ).getByRole('button', { name: 'Retry' }),
  );
  await screen.findByText('Fictional page 1');
  fireEvent.click(screen.getByRole('button', { name: 'Next messages' }));
  await screen.findByText('Fictional page 2');
  fireEvent.click(screen.getByRole('button', { name: 'Previous messages' }));
  await screen.findByText('Fictional page 1');
});

test('debounces a literal search into the URL and restricts status import to administrators', async () => {
  window.user = { roles: ['admin'] };
  load.mockImplementation(async () => ({
    items: [],
    hasMore: false,
    total: 0,
    matchingTotal: 0,
    statusCounts: {},
  }));
  render(<SupportInbox />);
  expect(
    screen.getByRole('region', { name: 'Zendesk status import' }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search requests'), {
    target: { value: 'literal.* text' },
  });
  await waitFor(() =>
    expect(load).toHaveBeenCalledWith(
      '/api/admin/support?status=unresolved&page=1&q=literal.*+text',
    ),
  );
  expect(window.location.search).toContain('q=literal.*+text');
});

test('replaces a duplicate idempotent reply and reports retry failures', async () => {
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') return report;
    return { items: [report], hasMore: false };
  });
  loadConversation.mockResolvedValue({
    page: 1,
    hasMore: false,
    items: [
      {
        _id: 'reply-1',
        request: 'report-1',
        direction: 'inbound',
        kind: 'initial',
        body: 'Original attempt',
        createdAt: report.sent,
        deliveryState: 'received',
      },
      {
        _id: 'failed-reply',
        request: 'report-1',
        direction: 'outbound',
        kind: 'reply',
        body: 'Needs retry',
        createdAt: report.sent,
        deliveryState: 'failed',
      },
      {
        _id: 'captured-reply',
        request: 'report-1',
        direction: 'outbound',
        kind: 'reply',
        body: 'Captured in test mode',
        createdAt: report.sent,
        deliveryState: 'captured',
      },
      {
        _id: 'failed-acknowledgement',
        request: 'report-1',
        direction: 'outbound',
        kind: 'acknowledgement',
        body: 'Acknowledgement remains read only',
        createdAt: report.sent,
        deliveryState: 'failed',
      },
    ],
  });
  sendReply.mockResolvedValue({
    _id: 'reply-1',
    request: 'report-1',
    direction: 'outbound',
    kind: 'reply',
    body: 'Already queued response',
    createdAt: report.sent,
    deliveryState: 'queued',
  });
  retryReply.mockRejectedValueOnce(new Error('Unavailable'));
  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  await screen.findByRole('region', { name: 'Support conversation' });
  const conversation = await screen.findByRole('region', {
    name: 'Support conversation',
  });
  fireEvent.change(within(conversation).getByLabelText('Reply to requester'), {
    target: { value: 'A response whose first result was lost' },
  });
  fireEvent.click(
    within(conversation).getByRole('button', { name: 'Send reply' }),
  );
  await screen.findByText('Already queued response');
  expect(within(conversation).getAllByRole('article')).toHaveLength(4);
  expect(within(conversation).getAllByText('Support team')).toHaveLength(4);
  expect(
    within(conversation).getByText('Captured for testing (not sent)'),
  ).toBeInTheDocument();
  expect(
    within(conversation).getAllByRole('button', { name: 'Retry delivery' }),
  ).toHaveLength(1);
  fireEvent.click(
    within(conversation).getByRole('button', { name: 'Retry delivery' }),
  );
  await waitFor(() => expect(retryReply).toHaveBeenCalled());
  await screen.findByText('Retry could not be queued.');
});

test('updates a failed reply after a successful retry and leaves other messages', async () => {
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') return report;
    return { items: [report], hasMore: false };
  });
  loadConversation.mockResolvedValue({
    page: 1,
    hasMore: false,
    items: [
      {
        _id: 'failed-to-retry',
        request: 'report-1',
        direction: 'outbound',
        kind: 'reply',
        body: 'Fictional retry message',
        createdAt: report.sent,
        deliveryState: 'failed',
      },
      {
        _id: 'unrelated-inbound',
        request: 'report-1',
        direction: 'inbound',
        kind: 'reply',
        body: 'Fictional requester follow-up',
        createdAt: report.sent,
        deliveryState: 'received',
      },
    ],
  });
  retryReply.mockResolvedValue({
    _id: 'failed-to-retry',
    request: 'report-1',
    direction: 'outbound',
    kind: 'reply',
    body: 'Fictional retry message',
    createdAt: report.sent,
    deliveryState: 'queued',
  });
  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  const conversation = await screen.findByRole('region', {
    name: 'Support conversation',
  });
  fireEvent.click(
    await within(conversation).findByRole('button', {
      name: 'Retry delivery',
    }),
  );
  await within(conversation).findByText('Queued');
  expect(
    within(conversation).getByText('Fictional requester follow-up'),
  ).toBeVisible();
  expect(retryReply).toHaveBeenCalledWith(
    'report-1',
    'failed-to-retry',
    expect.any(String),
    false,
  );
});

test('ignores conversation results after the selected request unmounts', async () => {
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') return report;
    return { items: [report], hasMore: false };
  });
  let resolveConversation: (value: {
    items: [];
    page: number;
    hasMore: boolean;
  }) => void = () => {};
  loadConversation.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveConversation = resolve;
      }),
  );
  const view = render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  await screen.findByText('Loading conversation…');
  view.unmount();
  await act(async () => {
    resolveConversation({ items: [], page: 1, hasMore: false });
  });

  let rejectConversation: (error: Error) => void = () => {};
  loadConversation.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectConversation = reject;
      }),
  );
  const nextView = render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  await screen.findByText('Loading conversation…');
  nextView.unmount();
  await act(async () => {
    rejectConversation(new Error('Late failure'));
  });
});

test('uses a fallback idempotency key when crypto UUIDs are unavailable', async () => {
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') return report;
    return { items: [report], hasMore: false };
  });
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'crypto',
  );
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {},
  });
  try {
    render(<SupportInbox />);
    fireEvent.click(
      await screen.findByRole('button', {
        name: /fictional-reporter · Report a member/,
      }),
    );
    fireEvent.change(await screen.findByLabelText('Reply to requester'), {
      target: { value: 'Fictional key fallback reply' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
    await screen.findByText('Fictional response');
    expect(sendReply).toHaveBeenCalledWith(
      'report-1',
      'Fictional key fallback reply',
      expect.stringMatching(/^\d+-[a-z0-9]+$/),
    );
  } finally {
    if (cryptoDescriptor)
      Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
  }
});

test('does not submit an empty or already-sending reply', async () => {
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') return report;
    return { items: [report], hasMore: false };
  });
  let resolveReply: (
    value: Awaited<ReturnType<typeof api.sendReply>>,
  ) => void = () => {};
  sendReply.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveReply = resolve;
      }),
  );
  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  const composer = await screen.findByLabelText('Reply to requester');
  const form = composer.closest('form')!;
  fireEvent.submit(form);
  expect(sendReply).not.toHaveBeenCalled();
  fireEvent.change(composer, { target: { value: 'Fictional pending reply' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  await screen.findByRole('button', { name: 'Sending…' });
  fireEvent.submit(form);
  expect(sendReply).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolveReply({
      _id: 'pending-reply',
      request: 'report-1',
      direction: 'outbound',
      kind: 'reply',
      body: 'Fictional pending reply',
      createdAt: report.sent,
      deliveryState: 'queued',
    });
  });
  await screen.findByText('Fictional pending reply');
});

test('shows an empty thread and appends a newly queued message', async () => {
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') return report;
    return { items: [report], hasMore: false };
  });
  loadConversation.mockResolvedValue({ items: [], page: 1, hasMore: false });
  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  await screen.findByText('No messages yet.');
  fireEvent.change(await screen.findByLabelText('Reply to requester'), {
    target: { value: 'Fictional first reply' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  await screen.findByText('Fictional response');
  expect(
    screen.getByRole('article', {
      name: /Fictional Support, 2026-01-02 12:00/,
    }),
  ).toBeInTheDocument();
});

test('collapses quoted text without dropping it and refreshes stored messages', async () => {
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') return report;
    return { items: [report], hasMore: false };
  });
  loadConversation.mockResolvedValue({
    items: [
      {
        _id: 'quoted-reply',
        request: 'report-1',
        direction: 'inbound',
        kind: 'reply',
        body: 'Fictional new note\n\n> Quoted requester message\nFrom: requester@example.test',
        createdAt: report.sent,
        deliveryState: 'received',
      },
      {
        _id: 'plain-reply',
        request: 'report-1',
        direction: 'inbound',
        kind: 'reply',
        body: 'Fictional text with no recognised quote marker.',
        createdAt: report.sent,
        deliveryState: 'received',
      },
    ],
    page: 1,
    hasMore: false,
  });
  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  const conversation = await screen.findByRole('region', {
    name: 'Support conversation',
  });
  expect(
    await within(conversation).findByText('Fictional new note'),
  ).toBeVisible();
  const quotedText = within(conversation).getByText(/Quoted requester message/);
  expect(quotedText).not.toBeVisible();
  expect(
    within(conversation).getByText(
      'Fictional text with no recognised quote marker.',
    ),
  ).toBeVisible();
  fireEvent.click(within(conversation).getByText('Show quoted correspondence'));
  expect(quotedText).toBeVisible();
  expect(quotedText.parentElement).toHaveTextContent(
    'From: requester@example.test',
  );
  fireEvent.click(
    within(conversation).getByRole('button', { name: 'Refresh conversation' }),
  );
  await waitFor(() => expect(loadConversation).toHaveBeenCalledTimes(2));
});

test('ignores a failed queue request that settles after unmount', async () => {
  let rejectQueue: (error: Error) => void = () => {};
  listRequests.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectQueue = reject;
      }),
  );
  const view = render(<SupportInbox />);
  await screen.findByText('Loading…');
  view.unmount();
  await act(async () => {
    rejectQueue(new Error('Late failure'));
  });
});

test('decodes support entities once and keeps decoded markup inert', async () => {
  const body =
    'A &quot;fictional topic&quot; &amp; &#39;reply&#39; &#x1F642; &lt;img src=x onerror=alert(1)&gt; <b>plain</b> &amp;quot;';
  loadConversation.mockResolvedValue({
    items: [
      {
        _id: 'entity-message',
        direction: 'inbound',
        kind: 'reply',
        body,
        createdAt: '2026-01-02T12:00:00Z',
        deliveryState: 'received',
      },
    ],
  } as never);
  load.mockImplementation(async path => {
    if (path === '/api/admin/support/report-1') return report;
    return { items: [report], hasMore: false };
  });
  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  const conversation = await screen.findByRole('region', {
    name: 'Support conversation',
  });
  expect(
    await within(conversation).findByText(
      'A "fictional topic" & \'reply\' 🙂 <img src=x onerror=alert(1)> <b>plain</b> &quot;',
    ),
  ).toBeVisible();
  expect(conversation.querySelector('img, script, b')).toBeNull();
});
