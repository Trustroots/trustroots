import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import AdminNewsletter from '@/modules/admin/client/components/AdminNewsletter.component';
import * as newsletterApi from '@/modules/admin/client/api/newsletter.api';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';

jest.mock('@/modules/admin/client/api/newsletter.api');
jest.mock('@/modules/tribes/client/api/tribes.api');

describe('<AdminNewsletter />', () => {
  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:newsletter');
    URL.revokeObjectURL = jest.fn();
    HTMLAnchorElement.prototype.click = jest.fn();
    tribesApi.read.mockReturnValue(new Promise(() => {}));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the newsletter split form', () => {
    render(<AdminNewsletter />);

    expect(screen.getByText('Newsletter subscribers')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Export all subscribers CSV' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Export circle subscribers CSV' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/one eligible list and one excluded list with reasons/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Check recipients' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Count recipients' }),
    ).toBeInTheDocument();
  });

  it('loads circles and previews a combined location and circle audience', async () => {
    tribesApi.read.mockResolvedValueOnce([
      { _id: '5fbab4f7fed63c7ed73276d3', label: 'Cyclists' },
      { _id: '5fbab4f7fed63c7ed73276d4', label: 'Hitchhikers' },
    ]);
    newsletterApi.previewNewsletterAudience.mockResolvedValueOnce({ count: 2 });
    render(<AdminNewsletter />);

    fireEvent.change(screen.getByLabelText('Location name'), {
      target: { value: 'Berlin' },
    });
    fireEvent.change(screen.getByLabelText('Latitude'), {
      target: { value: '52.52' },
    });
    fireEvent.change(screen.getByLabelText('Longitude'), {
      target: { value: '13.405' },
    });
    fireEvent.change(screen.getByLabelText('Radius (kilometres)'), {
      target: { value: '25' },
    });
    const circles = await screen.findByLabelText('Circles (optional)');
    const cyclistOption = await screen.findByRole('option', {
      name: 'Cyclists',
    });
    cyclistOption.selected = true;
    fireEvent.change(circles);
    fireEvent.click(screen.getByRole('button', { name: 'Count recipients' }));

    await waitFor(() =>
      expect(newsletterApi.previewNewsletterAudience).toHaveBeenCalledWith({
        circleIds: ['5fbab4f7fed63c7ed73276d3'],
        latitude: '52.52',
        locationText: 'Berlin',
        longitude: '13.405',
        radiusKm: '25',
        sources: ['from', 'hosting', 'living'],
      }),
    );
    expect(
      await screen.findByText('2 eligible recipients match these filters.'),
    ).toBeVisible();
  });

  it('automatically refreshes the count after valid filters change', async () => {
    newsletterApi.previewNewsletterAudience.mockResolvedValueOnce({ count: 3 });
    render(<AdminNewsletter />);

    fireEvent.click(screen.getByLabelText('Hosting location'));
    fireEvent.change(screen.getByLabelText('Location name'), {
      target: { value: 'Berlin' },
    });

    expect(screen.getByText('Counting recipients…')).toBeVisible();
    await waitFor(
      () =>
        expect(newsletterApi.previewNewsletterAudience).toHaveBeenCalledWith(
          expect.objectContaining({
            locationText: 'Berlin',
            sources: ['from', 'living'],
          }),
        ),
      { timeout: 1500 },
    );
    expect(
      await screen.findByText('3 eligible recipients match these filters.'),
    ).toBeVisible();
  });

  it('automatically counts a circle-only audience', async () => {
    tribesApi.read.mockResolvedValueOnce([
      { _id: '5fbab4f7fed63c7ed73276d3', label: 'Cyclists' },
    ]);
    newsletterApi.previewNewsletterAudience.mockResolvedValueOnce({ count: 4 });
    render(<AdminNewsletter />);

    fireEvent.click(screen.getByLabelText('Living location'));
    fireEvent.click(screen.getByLabelText('Origin location'));
    fireEvent.click(screen.getByLabelText('Hosting location'));
    const circles = await screen.findByLabelText('Circles (optional)');
    const cyclistOption = await screen.findByRole('option', {
      name: 'Cyclists',
    });
    cyclistOption.selected = true;
    fireEvent.change(circles);

    await waitFor(
      () =>
        expect(newsletterApi.previewNewsletterAudience).toHaveBeenCalledWith(
          expect.objectContaining({
            circleIds: ['5fbab4f7fed63c7ed73276d3'],
            sources: [],
          }),
        ),
      { timeout: 1500 },
    );
    expect(
      await screen.findByText('4 eligible recipients match these filters.'),
    ).toBeVisible();
  });

  it('ignores completed requests for older filter configurations', async () => {
    let resolveFirst;
    let rejectSecond;
    let resolveThird;
    newsletterApi.previewNewsletterAudience
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            rejectSecond = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveThird = resolve;
          }),
      );
    render(<AdminNewsletter />);

    fireEvent.click(screen.getByLabelText('Hosting location'));
    fireEvent.change(screen.getByLabelText('Location name'), {
      target: { value: 'Berlin' },
    });
    await waitFor(
      () =>
        expect(newsletterApi.previewNewsletterAudience).toHaveBeenCalledTimes(
          1,
        ),
      { timeout: 1500 },
    );
    fireEvent.change(screen.getByLabelText('Location name'), {
      target: { value: 'Lisbon' },
    });
    await waitFor(
      () =>
        expect(newsletterApi.previewNewsletterAudience).toHaveBeenCalledTimes(
          2,
        ),
      { timeout: 1500 },
    );
    fireEvent.change(screen.getByLabelText('Location name'), {
      target: { value: 'Porto' },
    });
    await waitFor(
      () =>
        expect(newsletterApi.previewNewsletterAudience).toHaveBeenCalledTimes(
          3,
        ),
      { timeout: 1500 },
    );

    await act(async () => {
      resolveThird({ count: 3 });
    });
    await screen.findByText('3 eligible recipients match these filters.');

    await act(async () => {
      resolveFirst({ count: 1 });
      rejectSecond(new Error('Stale request'));
    });
    expect(
      screen.getByText('3 eligible recipients match these filters.'),
    ).toBeVisible();
    expect(
      screen.queryByText('Could not preview this newsletter audience.'),
    ).not.toBeInTheDocument();
  });

  it('handles an empty circle response and can reselect a location source', async () => {
    tribesApi.read.mockResolvedValueOnce(null);
    render(<AdminNewsletter />);

    await waitFor(() =>
      expect(tribesApi.read).toHaveBeenCalledWith({ limit: 500 }),
    );
    fireEvent.click(screen.getByLabelText('Hosting location'));
    expect(screen.getByLabelText('Hosting location')).not.toBeChecked();
    expect(screen.queryByLabelText('Latitude')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Hosting location'));
    expect(screen.getByLabelText('Hosting location')).toBeChecked();
    expect(screen.getByLabelText('Latitude')).toBeInTheDocument();
  });

  it('previews one recipient and exports the audience CSV', async () => {
    newsletterApi.previewNewsletterAudience.mockResolvedValueOnce({ count: 1 });
    newsletterApi.getNewsletterAudienceCsv.mockResolvedValueOnce(
      'Email Address,First Name,Last Name\nmember@example.com,Example,Member',
    );
    render(<AdminNewsletter />);

    fireEvent.click(screen.getByLabelText('Hosting location'));
    fireEvent.change(screen.getByLabelText('Location name'), {
      target: { value: 'Berlin' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Count recipients' }));

    expect(
      await screen.findByText('1 eligible recipient matches these filters.'),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Export audience CSV' }),
    );

    await waitFor(() =>
      expect(newsletterApi.getNewsletterAudienceCsv).toHaveBeenCalledWith(
        expect.objectContaining({
          locationText: 'Berlin',
          sources: ['from', 'living'],
        }),
      ),
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('clears an audience preview after criteria change', async () => {
    newsletterApi.previewNewsletterAudience.mockResolvedValueOnce({ count: 0 });
    render(<AdminNewsletter />);

    fireEvent.click(screen.getByLabelText('Hosting location'));
    fireEvent.change(screen.getByLabelText('Location name'), {
      target: { value: 'Berlin' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Count recipients' }));
    expect(
      await screen.findByText('0 eligible recipients match these filters.'),
    ).toBeVisible();

    fireEvent.change(screen.getByLabelText('Location name'), {
      target: { value: 'Lisbon' },
    });
    expect(
      screen.queryByText('0 eligible recipients match these filters.'),
    ).not.toBeInTheDocument();
  });

  it('shows API and fallback errors for audience actions', async () => {
    newsletterApi.previewNewsletterAudience
      .mockRejectedValueOnce({
        response: { data: { message: 'Choose valid criteria.' } },
      })
      .mockRejectedValueOnce(new Error('Network issue'));
    render(<AdminNewsletter />);

    fireEvent.click(screen.getByRole('button', { name: 'Count recipients' }));
    expect(await screen.findByText('Choose valid criteria.')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Count recipients' }));
    expect(
      await screen.findByText('Could not preview this newsletter audience.'),
    ).toBeVisible();
  });

  it('shows circle loading and audience export errors', async () => {
    tribesApi.read.mockRejectedValueOnce(new Error('Network issue'));
    newsletterApi.previewNewsletterAudience.mockResolvedValueOnce({ count: 1 });
    newsletterApi.getNewsletterAudienceCsv.mockRejectedValueOnce(
      new Error('Network issue'),
    );
    render(<AdminNewsletter />);

    expect(
      await screen.findByText(
        'Could not load circles. Location filters are still available.',
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByLabelText('Hosting location'));
    fireEvent.change(screen.getByLabelText('Location name'), {
      target: { value: 'Berlin' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Count recipients' }));
    await screen.findByText('1 eligible recipient matches these filters.');
    fireEvent.click(
      screen.getByRole('button', { name: 'Export audience CSV' }),
    );
    expect(
      await screen.findByText('Could not export this newsletter audience.'),
    ).toBeVisible();
  });

  it('shows an error when submitting without selecting a file', async () => {
    render(<AdminNewsletter />);

    fireEvent.click(screen.getByRole('button', { name: 'Check recipients' }));

    expect(
      await screen.findByText('Choose a CSV, JSONL, or NDJSON file first.'),
    ).toBeVisible();
    expect(newsletterApi.splitNewsletterSubscribers).not.toHaveBeenCalled();
  });

  it('exports all subscribers CSV', async () => {
    newsletterApi.getNewsletterSubscribersCsv.mockResolvedValueOnce(
      'Email Address,First Name,Last Name\nalice@example.com,Alice,Example',
    );
    render(<AdminNewsletter />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Export all subscribers CSV' }),
    );

    await waitFor(() =>
      expect(newsletterApi.getNewsletterSubscribersCsv).toHaveBeenCalledTimes(
        1,
      ),
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('validates circle export input', async () => {
    render(<AdminNewsletter />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Export circle subscribers CSV' }),
    );

    expect(await screen.findByText('Enter a circle ID first.')).toBeVisible();
    expect(
      newsletterApi.getNewsletterCircleSubscribersCsv,
    ).not.toHaveBeenCalled();
  });

  it('exports circle subscribers CSV', async () => {
    newsletterApi.getNewsletterCircleSubscribersCsv.mockResolvedValueOnce(
      'Email Address,First Name,Last Name\nalice@example.com,Alice,Example',
    );
    render(<AdminNewsletter />);

    fireEvent.change(screen.getByLabelText('Circle ID'), {
      target: { value: '5fbab4f7fed63c7ed73276d3' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Export circle subscribers CSV' }),
    );

    await waitFor(() =>
      expect(
        newsletterApi.getNewsletterCircleSubscribersCsv,
      ).toHaveBeenCalledWith('5fbab4f7fed63c7ed73276d3'),
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('uploads and shows download actions for both CSV outputs', async () => {
    newsletterApi.splitNewsletterSubscribers.mockResolvedValueOnce({
      outputFormat: 'csv',
      subscribedCount: 1,
      subscribedContent:
        'Email Address,First Name,Last Name\nalice@example.com,Alice,Example',
      totalEmailCount: 2,
      unsubscribedCount: 1,
      unsubscribedContent:
        'Email Address,First Name,Last Name\nbob@example.com,Bob,Example',
    });
    const file = new File(
      ['Email Address\nalice@example.com\nbob@example.com'],
      'newsletter.csv',
      {
        type: 'text/csv',
      },
    );

    render(<AdminNewsletter />);

    fireEvent.change(
      screen.getByLabelText('Recipient file (CSV, JSONL, or NDJSON)'),
      {
        target: { files: [file] },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Check recipients' }));

    await waitFor(() =>
      expect(newsletterApi.splitNewsletterSubscribers).toHaveBeenCalledWith(
        file,
      ),
    );
    expect(
      await screen.findByText('Processed 2 emails: 1 eligible and 1 excluded.'),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: 'Download eligible CSV' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Download excluded CSV' }),
    );

    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it('downloads JSONL split results as JSONL', async () => {
    newsletterApi.splitNewsletterSubscribers.mockResolvedValueOnce({
      outputFormat: 'jsonl',
      subscribedCount: 1,
      subscribedContent: '{"email":"eligible@example.com"}',
      totalEmailCount: 2,
      unsubscribedCount: 1,
      unsubscribedContent:
        '{"email":"excluded@example.com","reason":"Newsletter disabled"}',
    });
    const file = new File(
      ['{"email":"eligible@example.com"}'],
      'newsletter.jsonl',
      {
        type: 'application/x-ndjson',
      },
    );
    render(<AdminNewsletter />);

    fireEvent.change(
      screen.getByLabelText('Recipient file (CSV, JSONL, or NDJSON)'),
      {
        target: { files: [file] },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Check recipients' }));

    fireEvent.click(
      await screen.findByRole('button', { name: 'Download eligible JSONL' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Download excluded JSONL' }),
    );

    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
  });

  it('shows API error text when splitting fails', async () => {
    newsletterApi.splitNewsletterSubscribers.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Unsupported file type.',
        },
      },
    });
    const file = new File(['not-an-email'], 'newsletter.txt', {
      type: 'text/plain',
    });

    render(<AdminNewsletter />);

    fireEvent.change(
      screen.getByLabelText('Recipient file (CSV, JSONL, or NDJSON)'),
      {
        target: { files: [file] },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Check recipients' }));

    expect(await screen.findByText('Unsupported file type.')).toBeVisible();
  });

  it('shows fallback error text when splitting fails without API message', async () => {
    newsletterApi.splitNewsletterSubscribers.mockRejectedValueOnce(
      new Error('Network issue'),
    );
    const file = new File(
      ['Email Address\nalice@example.com'],
      'newsletter.csv',
      {
        type: 'text/csv',
      },
    );

    render(<AdminNewsletter />);

    fireEvent.change(
      screen.getByLabelText('Recipient file (CSV, JSONL, or NDJSON)'),
      {
        target: { files: [file] },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Check recipients' }));

    expect(
      await screen.findByText(
        'Could not split newsletter subscribers from this recipient file.',
      ),
    ).toBeVisible();
  });

  it('clears selected file when file input becomes empty', async () => {
    const file = new File(
      ['Email Address\nalice@example.com'],
      'newsletter.csv',
      {
        type: 'text/csv',
      },
    );
    render(<AdminNewsletter />);

    fireEvent.change(
      screen.getByLabelText('Recipient file (CSV, JSONL, or NDJSON)'),
      {
        target: { files: [file] },
      },
    );
    fireEvent.change(
      screen.getByLabelText('Recipient file (CSV, JSONL, or NDJSON)'),
      {
        target: { files: null },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Check recipients' }));

    expect(
      await screen.findByText('Choose a CSV, JSONL, or NDJSON file first.'),
    ).toBeVisible();
    expect(newsletterApi.splitNewsletterSubscribers).not.toHaveBeenCalled();
  });

  it('shows API error text when export fails', async () => {
    newsletterApi.getNewsletterSubscribersCsv.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Export failed.',
        },
      },
    });
    render(<AdminNewsletter />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Export all subscribers CSV' }),
    );

    expect(await screen.findByText('Export failed.')).toBeVisible();
  });

  it('shows fallback error text when export all fails without API message', async () => {
    newsletterApi.getNewsletterSubscribersCsv.mockRejectedValueOnce(
      new Error('Network issue'),
    );
    render(<AdminNewsletter />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Export all subscribers CSV' }),
    );

    expect(
      await screen.findByText('Could not export newsletter subscribers.'),
    ).toBeVisible();
  });

  it('shows fallback error text when circle export fails without API message', async () => {
    newsletterApi.getNewsletterCircleSubscribersCsv.mockRejectedValueOnce(
      new Error('Network issue'),
    );
    render(<AdminNewsletter />);

    fireEvent.change(screen.getByLabelText('Circle ID'), {
      target: { value: '5fbab4f7fed63c7ed73276d3' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Export circle subscribers CSV' }),
    );

    expect(
      await screen.findByText(
        'Could not export newsletter subscribers for this circle.',
      ),
    ).toBeVisible();
  });
});
