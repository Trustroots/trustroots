import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ExperienceChangePage from '@/modules/experiences/client/components/ExperienceChangePage';
import * as api from '@/modules/experiences/client/api/experience-changes.api';

jest.mock('@/modules/experiences/client/api/experience-changes.api');

const experience = {
  _id: 'experience-1',
  canEdit: true,
  feedbackPublic: 'Original feedback',
  recommend: 'yes',
  interactions: { met: true, host: false, guest: false },
};

beforeEach(() => {
  window.history.replaceState(
    {},
    '',
    '/experiences/experience-1/change?secret=example',
  );
  api.readAccess.mockResolvedValue(experience);
  api.readMine.mockResolvedValue(null);
});

afterEach(() => jest.clearAllMocks());

it('lets the author propose an edit while retaining the current values initially', async () => {
  api.submit.mockResolvedValue({ kind: 'edit', status: 'pending' });
  render(<ExperienceChangePage id="experience-1" />);

  expect(await screen.findByLabelText('Written feedback')).toHaveValue(
    'Original feedback',
  );
  fireEvent.change(screen.getByLabelText('Written feedback'), {
    target: { value: 'Revised feedback' },
  });
  fireEvent.change(screen.getByLabelText('Recommendation'), {
    target: { value: 'no' },
  });
  fireEvent.click(screen.getByLabelText('I hosted them'));
  fireEvent.click(screen.getByRole('button', { name: 'Request edit' }));

  await waitFor(() =>
    expect(api.submit).toHaveBeenCalledWith('experience-1', 'example', {
      kind: 'edit',
      proposed: {
        feedbackPublic: 'Revised feedback',
        recommend: 'no',
        interactions: { met: true, host: true, guest: false },
      },
    }),
  );
  expect(await screen.findByRole('status')).toHaveTextContent(
    'awaiting admin review',
  );
});

it('shows removal without edit controls to the recipient', async () => {
  api.readAccess.mockResolvedValueOnce({ _id: 'experience-1', canEdit: false });
  api.submit.mockResolvedValue({ kind: 'remove', status: 'pending' });
  render(<ExperienceChangePage id="experience-1" />);

  await screen.findByRole('button', { name: 'Request removal' });
  expect(screen.queryByLabelText('Written feedback')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Request removal' }));
  await waitFor(() =>
    expect(api.submit).toHaveBeenCalledWith('experience-1', 'example', {
      kind: 'remove',
    }),
  );
});

it('shows status after a link expires without allowing another submission', async () => {
  api.readAccess.mockRejectedValueOnce(new Error('expired'));
  api.readMine.mockResolvedValueOnce({ kind: 'edit', status: 'approved' });
  render(<ExperienceChangePage id="experience-1" />);

  expect(await screen.findByRole('status')).toHaveTextContent('approved');
  expect(
    screen.getByText(/link is invalid or has expired/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Request edit' }),
  ).not.toBeInTheDocument();
});

it('shows a rejected removal request and keeps the new request controls available', async () => {
  api.readMine.mockResolvedValueOnce({ kind: 'remove', status: 'rejected' });
  render(<ExperienceChangePage id="experience-1" />);

  expect(await screen.findByRole('status')).toHaveTextContent(
    'removal request is rejected',
  );
  expect(screen.getByRole('button', { name: 'Request edit' })).toBeEnabled();
});

it('shows server validation errors from submission', async () => {
  api.submit.mockRejectedValueOnce({
    response: { data: { message: 'A request is already pending.' } },
  });
  render(<ExperienceChangePage id="experience-1" />);
  await screen.findByRole('button', { name: 'Request removal' });

  fireEvent.click(screen.getByRole('button', { name: 'Request removal' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'A request is already pending.',
  );
});

it('handles a missing secret and unavailable status or submission', async () => {
  window.history.replaceState({}, '', '/experiences/experience-1/change');
  api.readMine.mockRejectedValueOnce(new Error('unavailable'));
  api.submit.mockRejectedValueOnce(new Error('unavailable'));
  render(<ExperienceChangePage id="experience-1" />);
  await screen.findByRole('button', { name: 'Request removal' });

  expect(api.readAccess).toHaveBeenCalledWith('experience-1', '');
  fireEvent.click(screen.getByRole('button', { name: 'Request removal' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not submit your request.',
  );
});

it('discards access results after leaving the page', async () => {
  let resolveAccess;
  api.readAccess.mockReturnValueOnce(
    new Promise(resolve => {
      resolveAccess = resolve;
    }),
  );
  const { unmount } = render(<ExperienceChangePage id="experience-1" />);
  unmount();
  resolveAccess(experience);
  await waitFor(() => expect(api.readAccess).toHaveBeenCalledTimes(1));
});
