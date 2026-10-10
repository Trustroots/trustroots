import React from 'react';
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import SupportInbox, {
  SupportMemberPage,
} from '../../../client/components/Support.component';
import * as api from '../../../client/api/support.api';

jest.mock('../../../client/api/support.api', () => ({
  load: jest.fn(),
  setStatus: jest.fn(),
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
      return { ...report, status: resolved ? 'resolved' : 'open' };
    return { items: [report], hasMore: true };
  });
  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /fictional-reporter · Report a member/,
    }),
  );
  expect(await screen.findByText(report.message)).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Reported account and notes' }),
  ).toHaveAttribute('href', '/admin/support/member/target-1');
  fireEvent.click(screen.getByRole('button', { name: 'View conversation' }));
  expect(await screen.findByText('Hidden context')).toBeInTheDocument();
  expect(screen.getByText('Hidden message')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View experiences' }));
  expect(await screen.findByText('Unpublished feedback')).toBeInTheDocument();
  expect(
    screen.getByText('Unpublished · Recommendation: no'),
  ).toBeInTheDocument();
  resolved = true;
  fireEvent.click(screen.getByRole('button', { name: 'Resolve request' }));
  await screen.findByRole('button', { name: 'Reopen request' });
  expect(setStatus).toHaveBeenCalledWith('report-1', 'resolved');
  resolved = false;
  fireEvent.click(screen.getByRole('button', { name: 'Reopen request' }));
  await screen.findByRole('button', { name: 'Resolve request' });
  expect(setStatus).toHaveBeenCalledWith('report-1', 'open');
  fireEvent.click(screen.getAllByRole('button', { name: 'Next' })[0]);
  await waitFor(() =>
    expect(load).toHaveBeenCalledWith('/api/admin/support?status=open&page=2'),
  );
  fireEvent.click(screen.getAllByRole('button', { name: 'Previous' })[0]);
  fireEvent.change(screen.getByLabelText('Status'), {
    target: { value: 'resolved' },
  });
  fireEvent.change(screen.getByLabelText('Category'), {
    target: { value: 'reportMember' },
  });
  await waitFor(() =>
    expect(load).toHaveBeenCalledWith(
      '/api/admin/support?status=resolved&page=1&category=reportMember',
    ),
  );
});

test('handles missing linkage, empty results and search errors', async () => {
  load.mockImplementation(async path => {
    if (path.startsWith('/api/admin/support-members')) return [member];
    if (path === '/api/admin/support/report-1')
      return {
        ...report,
        reportedUser: undefined,
        user: undefined,
        username: undefined,
        status: undefined,
      };
    return {
      items: [{ ...report, username: undefined, status: undefined }],
      hasMore: false,
    };
  });
  render(<SupportInbox />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: /reporter@example.test · Report a member/,
    }),
  );
  expect(
    await screen.findByText(/No verified member pair/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'View conversation' }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Name, username or email'), {
    target: { value: 'fictional' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Search members' }));
  expect(
    await screen.findByRole('link', {
      name: 'fictional-target (Fictional Member)',
    }),
  ).toHaveAttribute('href', '/admin/support/member/target-1');
  load.mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button', { name: 'Search members' }));
  await screen.findByText('No members found.');
  load.mockRejectedValue(new Error('Unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Search members' }));
  await screen.findByRole('alert');
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
  fireEvent.click(screen.getByRole('button', { name: 'Resolve request' }));
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
      '/api/admin/support?status=open&page=1',
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
