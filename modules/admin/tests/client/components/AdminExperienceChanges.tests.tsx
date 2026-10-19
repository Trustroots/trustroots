import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminExperienceChanges from '@/modules/admin/client/components/AdminExperienceChanges';
import * as api from '@/modules/admin/client/api/admin-experience-changes.api';
import type {
  AdminExperienceChangeRequest,
  AdminExperienceChangeSearchExperience,
} from '@/modules/admin/shared/admin-experience-change';

jest.mock('@/modules/admin/client/api/admin-experience-changes.api');
jest.mock('@/modules/admin/client/components/AdminHeader.component', () => {
  return function MockAdminHeader() {
    return <nav>Admin</nav>;
  };
});

const apiMock = jest.mocked(api);

const experience: AdminExperienceChangeSearchExperience = {
  _id: 'experience-1',
  created: '2026-10-13T00:00:00.000Z',
  public: true,
  userFrom: { _id: 'author-1', displayName: 'Fictional Author' },
  userTo: { _id: 'recipient-1', displayName: 'Fictional Recipient' },
  recommend: 'yes',
  interactions: { met: true, guest: false, host: false },
  feedbackPublic: 'Original Experience',
};

function editRequest(
  overrides: Partial<
    Extract<AdminExperienceChangeRequest, { kind: 'edit' }>
  > = {},
): Extract<AdminExperienceChangeRequest, { kind: 'edit' }> {
  return {
    _id: 'request-1',
    requester: { _id: 'author-1', displayName: 'Fictional Author' },
    experience,
    status: 'pending',
    kind: 'edit',
    proposed: {
      feedbackPublic: 'Revised Experience',
      recommend: 'no',
      interactions: { met: true, guest: true, host: false },
    },
    ...overrides,
  };
}

afterEach(() => jest.clearAllMocks());

it('finds an Experience and creates a link for the selected member', async () => {
  apiMock.listRequests.mockResolvedValueOnce([]);
  apiMock.findExperiences.mockResolvedValueOnce([experience]);
  apiMock.issueLink.mockResolvedValueOnce({
    path: '/experiences/experience-1/change?secret=example',
    expiresAt: '2026-10-20T00:00:00.000Z',
  });
  render(<AdminExperienceChanges />);

  fireEvent.change(screen.getByLabelText('Member username'), {
    target: { value: 'fictional-author' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Find Experiences' }));
  expect(await screen.findByText(/Original Experience/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Copy link for author' }));

  await waitFor(() =>
    expect(apiMock.issueLink).toHaveBeenCalledWith('experience-1', 'author-1'),
  );
  await waitFor(() =>
    expect(screen.getByLabelText(/Support link/)).toHaveValue(
      'http://localhost/experiences/experience-1/change?secret=example',
    ),
  );
});

it('shows a pending request and records an admin decision', async () => {
  apiMock.listRequests
    .mockResolvedValueOnce([editRequest()])
    .mockResolvedValueOnce([
      editRequest({
        status: 'approved',
        experience: {
          ...experience,
          userFrom: {
            _id: 'author-1',
            displayName: 'Fictional Author',
            username: 'fictional-author',
          },
          userTo: {
            _id: 'recipient-1',
            displayName: 'Fictional Recipient',
            username: 'fictional-recipient',
          },
          feedbackPublic: 'Revised Experience',
        },
      }),
    ]);
  apiMock.decide.mockResolvedValueOnce({
    _id: 'request-1',
    status: 'approved',
  });
  render(<AdminExperienceChanges />);

  expect(await screen.findByText(/Revised Experience/)).toBeInTheDocument();
  expect(
    screen.getByText(
      (_, element) =>
        element?.tagName === 'P' &&
        element.textContent ===
          'Fictional Author wrote about Fictional Recipient (public).',
    ),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  await waitFor(() =>
    expect(apiMock.decide).toHaveBeenCalledWith('request-1', 'approve'),
  );
  expect(
    await screen.findByText('No requests awaiting review.'),
  ).toBeInTheDocument();
  expect(screen.getByText('Approved')).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Fictional Author' }),
  ).toHaveAttribute('href', '/profile/fictional-author/experiences');
  expect(
    screen.getByRole('link', { name: 'Fictional Recipient' }),
  ).toHaveAttribute('href', '/profile/fictional-recipient/experiences');
  expect(
    screen.queryByRole('button', { name: 'Approve' }),
  ).not.toBeInTheDocument();
});

it('shows unpublished Experiences and creates a link for the profile owner', async () => {
  apiMock.listRequests.mockResolvedValue([]);
  apiMock.findExperiences.mockResolvedValue([
    {
      ...experience,
      public: false,
      userFrom: { _id: 'author-1', username: 'fictional-author' },
      userTo: { _id: 'recipient-1', username: 'fictional-recipient' },
      interactions: undefined,
      feedbackPublic: '',
    },
  ]);
  apiMock.issueLink.mockResolvedValue({
    path: '/change?secret=example',
    expiresAt: '2026-10-20T00:00:00.000Z',
  });
  render(<AdminExperienceChanges />);

  fireEvent.change(screen.getByLabelText('Member username'), {
    target: { value: 'fictional-recipient' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Find Experiences' }));
  expect(await screen.findByText(/not yet public/)).toBeInTheDocument();
  expect(screen.getByText(/fictional-author/)).toBeInTheDocument();
  expect(screen.getByText(/Feedback: \(none\)/)).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Copy link for profile owner' }),
  );
  await waitFor(() =>
    expect(apiMock.issueLink).toHaveBeenCalledWith(
      'experience-1',
      'recipient-1',
    ),
  );
  const input = await screen.findByLabelText(/Support link/);
  fireEvent.focus(input);
  expect(input).toHaveValue('http://localhost/change?secret=example');
});

it('reports when a populated member is unavailable for link issuance', async () => {
  apiMock.listRequests.mockResolvedValue([]);
  apiMock.findExperiences.mockResolvedValue([
    { ...experience, userFrom: null },
  ]);
  render(<AdminExperienceChanges />);

  fireEvent.change(screen.getByLabelText('Member username'), {
    target: { value: 'fictional-author' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Find Experiences' }));
  expect(await screen.findByText('Unknown member')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Copy link for author' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not create the link',
  );
  expect(apiMock.issueLink).not.toHaveBeenCalled();
});

it('shows an error when search, link issuance, or review fails', async () => {
  const removalRequest: AdminExperienceChangeRequest = {
    _id: 'request-1',
    requester: { _id: 'member-1' },
    kind: 'remove',
    experience: null,
    status: 'pending',
  };
  apiMock.listRequests.mockResolvedValueOnce([removalRequest]);
  apiMock.findExperiences
    .mockRejectedValueOnce(new Error('search failed'))
    .mockResolvedValueOnce([experience]);
  apiMock.issueLink.mockRejectedValueOnce(new Error('link failed'));
  apiMock.decide.mockRejectedValueOnce(new Error('review failed'));
  render(<AdminExperienceChanges />);

  expect(await screen.findByText('Unknown member')).toBeInTheDocument();
  expect(
    screen.getByText('Experience no longer available.'),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Member username'), {
    target: { value: 'fictional-author' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Find Experiences' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not find Experiences',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Find Experiences' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Copy link for author' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not create the link',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not save the decision',
  );
});

it('shows a load error when the review queue is unavailable', async () => {
  apiMock.listRequests.mockRejectedValueOnce(new Error('unavailable'));
  render(<AdminExperienceChanges />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load change requests',
  );
});

it('copies an issued link and shows empty proposed feedback', async () => {
  const writeText = jest.fn().mockRejectedValue(new Error('clipboard blocked'));
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  apiMock.listRequests.mockResolvedValue([
    editRequest({
      experience: {
        ...experience,
        userFrom: 'author-1',
        userTo: 'recipient-1',
      },
      proposed: {
        recommend: 'unknown',
        interactions: { met: false, guest: false, host: false },
        feedbackPublic: '',
      },
    }),
  ]);
  apiMock.findExperiences.mockResolvedValue([experience]);
  apiMock.issueLink.mockResolvedValue({
    path: '/change?secret=example',
    expiresAt: '2026-10-20T00:00:00.000Z',
  });
  render(<AdminExperienceChanges />);

  expect(await screen.findByText('Feedback: (none)')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Member username'), {
    target: { value: 'fictional-author' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Find Experiences' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Copy link for author' }),
  );
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  expect(await screen.findByLabelText(/Support link/)).toHaveValue(
    'http://localhost/change?secret=example',
  );
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined,
  });
});

it('explains when a support member cannot change their own profile', async () => {
  apiMock.listRequests.mockResolvedValueOnce([
    editRequest({ canReview: false, canApprove: false }),
  ]);
  apiMock.findExperiences.mockResolvedValueOnce([
    { ...experience, canIssue: false },
  ]);
  render(<AdminExperienceChanges />);
  expect(
    await screen.findByText(
      'Support members cannot change Experiences on their own profile.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Member username'), {
    target: { value: 'fictional-author' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Find Experiences' }));
  expect(
    await screen.findByRole('button', { name: 'Copy link for author' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Copy link for profile owner' }),
  ).toBeDisabled();
  expect(
    screen.getAllByText(
      'Support members cannot change Experiences on their own profile.',
    ),
  ).toHaveLength(2);
});

it('explains when approval needs another reviewer while allowing rejection', async () => {
  apiMock.listRequests.mockResolvedValueOnce([
    editRequest({ canApprove: false }),
  ]);
  render(<AdminExperienceChanges />);
  expect(
    await screen.findByText(
      'Approval requires another support team member or an administrator.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Reject' })).toBeEnabled();
});
