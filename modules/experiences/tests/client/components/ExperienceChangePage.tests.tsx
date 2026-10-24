import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import ExperienceChangePage from '@/modules/experiences/client/components/ExperienceChangePage';
import * as api from '@/modules/experiences/client/api/experience-changes.api';
import type {
  ExperienceChangeAccess,
  ExperienceChangeRequestSummary,
} from '@/modules/experiences/shared/experience-change';

jest.mock('@/modules/experiences/client/api/experience-changes.api');

const apiMock = jest.mocked(api);

const experience: ExperienceChangeAccess = {
  _id: 'experience-1',
  public: true,
  canEdit: true,
  feedbackPublic: 'Original feedback',
  recommend: 'yes',
  interactions: { met: true, host: false, guest: false },
};

function request(
  kind: ExperienceChangeRequestSummary['kind'],
  status: ExperienceChangeRequestSummary['status'],
): ExperienceChangeRequestSummary {
  return {
    _id: 'request-1',
    kind,
    status,
    createdAt: '2026-10-13T00:00:00.000Z',
  };
}

beforeEach(() => {
  window.history.replaceState(
    {},
    '',
    '/experiences/experience-1/change?secret=example',
  );
  apiMock.readAccess.mockResolvedValue(experience);
  apiMock.readMine.mockResolvedValue(null);
});

afterEach(() => jest.clearAllMocks());

it('lets the author propose an edit while retaining the current values initially', async () => {
  apiMock.submit.mockResolvedValue(request('edit', 'pending'));
  render(<ExperienceChangePage id="experience-1" />);

  expect(
    await screen.findByRole('heading', { name: 'Change an Experience' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Change an Experience' }).parentElement,
  ).toHaveClass('container-spacer');
  expect(screen.getByLabelText('Written feedback')).toHaveValue(
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
    expect(apiMock.submit).toHaveBeenCalledWith('experience-1', 'example', {
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
  apiMock.readAccess.mockResolvedValueOnce({
    _id: 'experience-1',
    public: true,
    canEdit: false,
  });
  apiMock.submit.mockResolvedValue(request('remove', 'pending'));
  render(<ExperienceChangePage id="experience-1" />);

  await screen.findByRole('button', { name: 'Request removal' });
  expect(screen.queryByLabelText('Written feedback')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Request removal' }));
  await waitFor(() =>
    expect(apiMock.submit).toHaveBeenCalledWith('experience-1', 'example', {
      kind: 'remove',
    }),
  );
});

it('shows status after a link expires without allowing another submission', async () => {
  apiMock.readAccess.mockRejectedValueOnce(new Error('expired'));
  apiMock.readMine.mockResolvedValueOnce(request('edit', 'approved'));
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
  apiMock.readMine.mockResolvedValueOnce(request('remove', 'rejected'));
  render(<ExperienceChangePage id="experience-1" />);

  expect(await screen.findByRole('status')).toHaveTextContent(
    'removal request is rejected',
  );
  expect(screen.getByRole('button', { name: 'Request edit' })).toBeEnabled();
});

it('shows server validation errors from submission', async () => {
  apiMock.submit.mockRejectedValueOnce({
    response: { data: { message: 'A request is already pending.' } },
  });
  render(<ExperienceChangePage id="experience-1" />);
  await screen.findByRole('button', { name: 'Request removal' });

  fireEvent.click(screen.getByRole('button', { name: 'Request removal' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'A request is already pending.',
  );
});

it.each([
  ['missing response data', { response: {} }],
  ['null response data', { response: { data: null } }],
  ['missing message', { response: { data: {} } }],
  ['non-string message', { response: { data: { message: 409 } } }],
  ['empty message', { response: { data: { message: '' } } }],
])('uses the fallback for a %s', async (_caseName, error: unknown) => {
  apiMock.submit.mockRejectedValueOnce(error);
  render(<ExperienceChangePage id="experience-1" />);
  await screen.findByRole('button', { name: 'Request removal' });

  fireEvent.click(screen.getByRole('button', { name: 'Request removal' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not submit your request.',
  );
});

it('handles a missing secret and unavailable status or submission', async () => {
  window.history.replaceState({}, '', '/experiences/experience-1/change');
  apiMock.readMine.mockRejectedValueOnce(new Error('unavailable'));
  apiMock.submit.mockRejectedValueOnce(new Error('unavailable'));
  render(<ExperienceChangePage id="experience-1" />);
  await screen.findByRole('button', { name: 'Request removal' });

  expect(apiMock.readAccess).toHaveBeenCalledWith('experience-1', '');
  fireEvent.click(screen.getByRole('button', { name: 'Request removal' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not submit your request.',
  );
});

it('discards access results after leaving the page', async () => {
  let resolveAccess!: (value: ExperienceChangeAccess) => void;
  apiMock.readAccess.mockReturnValueOnce(
    new Promise(resolve => {
      resolveAccess = resolve;
    }),
  );
  const { unmount } = render(<ExperienceChangePage id="experience-1" />);
  unmount();
  resolveAccess(experience);
  await waitFor(() => expect(apiMock.readAccess).toHaveBeenCalledTimes(1));
});

it('explains processing and hides new submission controls', async () => {
  apiMock.readMine.mockResolvedValueOnce(request('edit', 'processing'));
  render(<ExperienceChangePage id="experience-1" />);
  expect(await screen.findByRole('status')).toHaveTextContent('being approved');
  expect(
    screen.queryByRole('button', { name: 'Request edit' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Request removal' }),
  ).not.toBeInTheDocument();
});
