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
    target: { value: '2026-10-28T07:30' },
  });
  fireEvent.change(screen.getByLabelText('To (UTC, exclusive)'), {
    target: { value: '2026-10-31T11:00' },
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
  await screen.findByText('12');
  expect(screen.getAllByText('—')).toHaveLength(5);
  expect(screen.getByText(/No emails are sent/)).toBeInTheDocument();
  submitPreview();
  expect(screen.getByText('Loading preview…')).toBeInTheDocument();
  await screen.findByText('Delivery unverified.');
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

it('shows event details, redaction placeholders and capped results', async () => {
  mocked.getSparkpostEvents.mockResolvedValue({
    date,
    capped: true,
    events: [
      {
        timestamp: '2026-10-30T12:00:00Z',
        type: 'delivery',
        campaign: 'confirm-email',
        recipientDomain: 'example.test',
      },
      {
        timestamp: '2026-10-30T12:00:01Z',
        type: 'bounce',
        campaign: '',
        recipientDomain: '',
      },
    ],
  });
  render(<AdminSparkpost />);
  fireEvent.click(
    await screen.findByRole('button', { name: `Inspect events for ${date}` }),
  );
  expect(screen.getByText('Loading events…')).toBeInTheDocument();
  await screen.findByText('example.test');
  expect(screen.getByText(/Partial results/)).toBeInTheDocument();
  expect(screen.getAllByText('Unknown')).toHaveLength(2);
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
  await screen.findByText('No events returned for this day.');
  submitPreview();
  await screen.findByText('No completed email jobs found in this window.');
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
  await screen.findByText(/Could not load events/);
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
