import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminSparkpost from '@/modules/admin/client/components/AdminSparkpost.component';
import * as api from '@/modules/admin/client/api/sparkpost.api';
import type { SparkpostOverview } from '@/modules/admin/shared/sparkpost';

jest.mock('@/modules/admin/client/api/sparkpost.api');
jest.mock(
  '@/modules/admin/client/components/SignupRecovery.component',
  () =>
    function Accounts() {
      return <p>Unconfirmed account list</p>;
    },
);
jest.mock(
  '@/modules/admin/client/components/SparkpostDaily.component',
  () =>
    function Daily() {
      return <p>Daily inspector</p>;
    },
);
jest.mock(
  '@/modules/admin/client/components/AdminHeader.component',
  () =>
    function MockAdminHeader() {
      return <nav>Admin navigation</nav>;
    },
);
const mocked = jest.mocked(api);
const date = new Date().toISOString().slice(0, 10);
const overview: SparkpostOverview = {
  provider: 'ready',
  rows: [
    {
      date,
      signups: 12,
      messages: 25,
      sent: 4,
      delivered: 3,
      bounced: 1,
      opens: 2,
      complaints: 0,
    },
    {
      date: '2020-01-01',
      signups: 0,
      messages: 0,
      sent: null,
      delivered: null,
      bounced: null,
      opens: null,
      complaints: null,
    },
  ],
};
function submitPreview() {
  fireEvent.change(screen.getByLabelText('From (UTC, inclusive)'), {
    target: { value: '2026-10-28 07:30' },
  });
  fireEvent.change(screen.getByLabelText('To (UTC, exclusive)'), {
    target: { value: '2026-10-31 11:00' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Preview completed jobs' }),
  );
}
beforeEach(() => {
  mocked.getSparkpostOverview.mockResolvedValue(overview);
});
afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
});

it('shows loading, daily metrics and a read-only preview with UTC inputs', async () => {
  mocked.getSparkpostPreview.mockResolvedValue({
    from: '2026-10-28T07:30:00.000Z',
    to: '2026-10-31T11:00:00.000Z',
    awaitingConfirmation: 8,
    jobsInspected: 1000,
    capped: true,
    campaigns: [{ campaign: 'confirm-email', count: 1000 }],
  });
  render(<AdminSparkpost />);
  expect(screen.getByText('Loading email diagnostics…')).toBeInTheDocument();
  expect(screen.getByLabelText('From (UTC, inclusive)')).toHaveValue(
    '2026-10-28 07:30',
  );
  expect(screen.getByLabelText('To (UTC, exclusive)')).toHaveValue(
    '2026-10-31 12:00',
  );
  await screen.findByText('12');
  expect(screen.getAllByText('—')).toHaveLength(5);
  expect(
    screen.getByText(/Recovery emails are queued only after/),
  ).toBeInTheDocument();
  submitPreview();
  expect(screen.getByText('Loading preview…')).toBeInTheDocument();
  await screen.findByText('Delivery unverified.');
  fireEvent.click(
    screen.getByRole('button', { name: 'Review unconfirmed accounts' }),
  );
  expect(screen.getByText('Unconfirmed account list')).toBeInTheDocument();
  expect(screen.getByText(/only the first 1,000/)).toBeInTheDocument();
  expect(screen.getByText('confirm-email')).toBeInTheDocument();
  expect(mocked.getSparkpostPreview).toHaveBeenCalledWith(
    '2026-10-28T07:30:00.000Z',
    '2026-10-31T11:00:00.000Z',
  );
  fireEvent.change(screen.getByLabelText('Reporting period'), {
    target: { value: '7' },
  });
  await waitFor(() =>
    expect(mocked.getSparkpostOverview).toHaveBeenLastCalledWith('7'),
  );
});

it('shows empty event and preview results', async () => {
  mocked.getSparkpostEvents.mockResolvedValue({
    date,
    capped: false,
    events: [],
  });
  mocked.getSparkpostPreview.mockResolvedValue({
    from: '',
    to: '',
    awaitingConfirmation: 0,
    jobsInspected: 0,
    capped: false,
    campaigns: [],
  });
  render(<AdminSparkpost />);
  fireEvent.click(
    await screen.findByRole('button', { name: `Inspect events for ${date}` }),
  );
  await screen.findByText('Daily inspector');
  submitPreview();
  await screen.findByText(
    /No stored email-job records were found for this period/,
  );
});

it('shows errors for overview, events and preview without raw provider errors', async () => {
  mocked.getSparkpostOverview.mockRejectedValueOnce(new Error('secret'));
  mocked.getSparkpostEvents.mockRejectedValue(new Error('secret'));
  mocked.getSparkpostPreview.mockRejectedValue(new Error('secret'));
  render(<AdminSparkpost />);
  await screen.findByText(/Could not load email diagnostics/);
  fireEvent.change(screen.getByLabelText('Reporting period'), {
    target: { value: '7' },
  });
  fireEvent.click(
    await screen.findByRole('button', { name: `Inspect events for ${date}` }),
  );
  await screen.findByText('Daily inspector');
  submitPreview();
  await screen.findByText(/Could not load the preview/);
  expect(screen.queryByText('secret')).not.toBeInTheDocument();
});

it.each(['disabled', 'unavailable'] as const)(
  'distinguishes %s provider data from zero',
  async provider => {
    mocked.getSparkpostOverview.mockResolvedValue({ ...overview, provider });
    render(<AdminSparkpost />);
    await screen.findByText(
      provider === 'disabled'
        ? /SparkPost is not configured/
        : /SparkPost metrics are unavailable/,
    );
    expect(
      screen.queryByRole('button', { name: /Inspect events/ }),
    ).not.toBeInTheDocument();
  },
);

it.each(['resolve', 'reject'] as const)(
  'ignores a late %s after the period changes',
  async result => {
    let resolve!: (value: SparkpostOverview) => void;
    let reject!: (error: Error) => void;
    mocked.getSparkpostOverview.mockReturnValueOnce(
      new Promise((yes, no) => {
        resolve = yes;
        reject = no;
      }),
    );
    render(<AdminSparkpost />);
    fireEvent.change(screen.getByLabelText('Reporting period'), {
      target: { value: '7' },
    });
    await screen.findByText('12');
    await act(async () => {
      if (result === 'resolve') resolve({ provider: 'disabled', rows: [] });
      else reject(new Error('stale'));
    });
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  },
);

it.each([
  ['10/28/2026 07:30', '2026-10-31 11:00', /Enter valid dates/],
  ['2026-02-30 07:30', '2026-10-31 11:00', /Enter valid dates/],
  ['2026-99-28 07:30', '2026-10-31 11:00', /Enter valid dates/],
  ['2026-10-28 07:30', 'bad', /Enter valid dates/],
  ['2026-10-31 11:00', '2026-10-28 07:30', /start must be earlier/],
  ['2026-08-01 00:00', '2026-10-31 11:00', /31 days or less/],
])(
  'validates the range %s to %s before requesting data',
  async (from, to, error) => {
    render(<AdminSparkpost />);
    await screen.findByText('12');
    fireEvent.change(screen.getByLabelText('From (UTC, inclusive)'), {
      target: { value: from },
    });
    fireEvent.change(screen.getByLabelText('To (UTC, exclusive)'), {
      target: { value: to },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview completed jobs' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(error);
    expect(mocked.getSparkpostPreview).not.toHaveBeenCalled();
  },
);

it('clamps a future end to now and updates the displayed UTC value', async () => {
  jest
    .spyOn(Date, 'now')
    .mockReturnValue(Date.parse('2026-10-31T12:34:56.789Z'));
  mocked.getSparkpostPreview.mockResolvedValue({
    from: '2026-10-28T07:30:00.000Z',
    to: '2026-10-31T12:34:56.789Z',
    awaitingConfirmation: 147,
    jobsInspected: 0,
    capped: false,
    campaigns: [],
  });
  render(<AdminSparkpost />);
  await screen.findByText('12');
  fireEvent.change(screen.getByLabelText('To (UTC, exclusive)'), {
    target: { value: '2026-11-01 00:00' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Preview completed jobs' }),
  );
  expect(screen.getByLabelText('To (UTC, exclusive)')).toHaveValue(
    '2026-10-31 12:34',
  );
  expect(mocked.getSparkpostPreview).toHaveBeenCalledWith(
    '2026-10-28T07:30:00.000Z',
    '2026-10-31T12:34:56.789Z',
  );
  await screen.findByText('147');
  expect(screen.getByText(/Future dates were changed/)).toBeInTheDocument();
  expect(
    screen.getByText(/This does not mean zero emails/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/2026-10-28 07:30 to 2026-10-31 12:34 UTC/),
  ).toBeInTheDocument();
});

it('clamps a future start too and explains when the resulting range is empty', async () => {
  jest
    .spyOn(Date, 'now')
    .mockReturnValue(Date.parse('2026-10-31T12:34:56.789Z'));
  render(<AdminSparkpost />);
  await screen.findByText('12');
  fireEvent.change(screen.getByLabelText('From (UTC, inclusive)'), {
    target: { value: '2026-11-01 00:00' },
  });
  fireEvent.change(screen.getByLabelText('To (UTC, exclusive)'), {
    target: { value: '2026-11-02 00:00' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Preview completed jobs' }),
  );
  expect(screen.getByLabelText('From (UTC, inclusive)')).toHaveValue(
    '2026-10-31 12:34',
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'The start must be earlier than the end.',
  );
  expect(mocked.getSparkpostPreview).not.toHaveBeenCalled();
});
