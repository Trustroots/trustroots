import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminExperienceChanges from '@/modules/admin/client/components/AdminExperienceChanges';
import * as api from '@/modules/admin/client/api/admin-experience-changes.api';

jest.mock('@/modules/admin/client/api/admin-experience-changes.api');
jest.mock('@/modules/admin/client/components/AdminHeader.component', () => {
  return function MockAdminHeader() {
    return <nav>Admin</nav>;
  };
});

const experience = {
  _id: 'experience-1',
  public: true,
  userFrom: { _id: 'author-1', displayName: 'Fictional Author' },
  userTo: { _id: 'recipient-1', displayName: 'Fictional Recipient' },
  recommend: 'yes',
  interactions: { met: true, guest: false, host: false },
  feedbackPublic: 'Original Experience',
};

afterEach(() => jest.clearAllMocks());

it('finds an Experience and creates a link for the selected member', async () => {
  api.listRequests.mockResolvedValueOnce([]);
  api.findExperiences.mockResolvedValueOnce([experience]);
  api.issueLink.mockResolvedValueOnce({
    path: '/experiences/experience-1/change?secret=example',
  });
  render(<AdminExperienceChanges />);

  fireEvent.change(screen.getByLabelText('Member username'), {
    target: { value: 'fictional-author' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Find Experiences' }));
  expect(await screen.findByText(/Original Experience/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Copy link for author' }));

  await waitFor(() =>
    expect(api.issueLink).toHaveBeenCalledWith('experience-1', 'author-1'),
  );
  await waitFor(() =>
    expect(screen.getByLabelText(/Support link/)).toHaveValue(
      'http://localhost/experiences/experience-1/change?secret=example',
    ),
  );
});

it('shows a pending request and records an admin decision', async () => {
  api.listRequests
    .mockResolvedValueOnce([
      {
        _id: 'request-1',
        requester: { displayName: 'Fictional Author' },
        kind: 'edit',
        experience,
        proposed: {
          feedbackPublic: 'Revised Experience',
          recommend: 'no',
          interactions: { met: true, guest: true, host: false },
        },
      },
    ])
    .mockResolvedValueOnce([]);
  api.decide.mockResolvedValueOnce({ status: 'approved' });
  render(<AdminExperienceChanges />);

  expect(await screen.findByText(/Revised Experience/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  await waitFor(() =>
    expect(api.decide).toHaveBeenCalledWith('request-1', 'approve'),
  );
  expect(
    await screen.findByText('No requests awaiting review.'),
  ).toBeInTheDocument();
});

it('shows unpublished Experiences and creates a link for the profile owner', async () => {
  api.listRequests.mockResolvedValue([]);
  api.findExperiences.mockResolvedValue([
    {
      ...experience,
      public: false,
      userFrom: { _id: 'author-1', username: 'fictional-author' },
      userTo: { _id: 'recipient-1', username: 'fictional-recipient' },
      interactions: undefined,
      feedbackPublic: '',
    },
  ]);
  api.issueLink.mockResolvedValue({ path: '/change?secret=example' });
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
    expect(api.issueLink).toHaveBeenCalledWith('experience-1', 'recipient-1'),
  );
  const input = await screen.findByLabelText(/Support link/);
  fireEvent.focus(input);
  expect(input).toHaveValue('http://localhost/change?secret=example');
});

it('shows an error when search, link issuance, or review fails', async () => {
  api.listRequests.mockResolvedValueOnce([
    {
      _id: 'request-1',
      requester: null,
      kind: 'remove',
      experience: null,
    },
  ]);
  api.findExperiences
    .mockRejectedValueOnce(new Error('search failed'))
    .mockResolvedValueOnce([experience]);
  api.issueLink.mockRejectedValueOnce(new Error('link failed'));
  api.decide.mockRejectedValueOnce(new Error('review failed'));
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
  api.listRequests.mockRejectedValueOnce(new Error('unavailable'));
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
  api.listRequests.mockResolvedValue([
    {
      _id: 'request-1',
      requester: { username: 'fictional-author' },
      kind: 'edit',
      experience,
      proposed: { recommend: 'unknown', interactions: {}, feedbackPublic: '' },
    },
  ]);
  api.findExperiences.mockResolvedValue([experience]);
  api.issueLink.mockResolvedValue({ path: '/change?secret=example' });
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
  delete navigator.clipboard;
});
