import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminNewsletter from '@/modules/admin/client/components/AdminNewsletter.component';
import * as newsletterApi from '@/modules/admin/client/api/newsletter.api';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';
import type { TribeSummary } from '@/modules/tribes/client/api/tribes.api';

jest.mock('@/modules/admin/client/api/newsletter.api');
jest.mock('@/modules/tribes/client/api/tribes.api');

const mockedNewsletterApi = jest.mocked(newsletterApi);
const mockedTribesApi = jest.mocked(tribesApi);
const clickedAnchors: HTMLAnchorElement[] = [];

type AudiencePreview = { count: number };

function circleSummary(_id: string, label: string): TribeSummary {
  return { _id, count: 0, label, slug: label.toLowerCase() };
}

describe('<AdminNewsletter />', () => {
  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:newsletter');
    URL.revokeObjectURL = jest.fn();
    clickedAnchors.length = 0;
    jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function captureClickedAnchor(
        this: HTMLAnchorElement,
      ) {
        clickedAnchors.push(this);
      });
    mockedTribesApi.read.mockReturnValue(new Promise<TribeSummary[]>(() => {}));
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
    mockedTribesApi.read.mockResolvedValueOnce([
      circleSummary('5fbab4f7fed63c7ed73276d3', 'Cyclists'),
      circleSummary('5fbab4f7fed63c7ed73276d4', 'Hitchhikers'),
    ]);
    mockedNewsletterApi.previewNewsletterAudience.mockResolvedValueOnce({
      count: 2,
    });
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
    // The option role ensures this queried element exposes `selected`.
    const cyclistOption = (await screen.findByRole('option', {
      name: 'Cyclists',
    })) as HTMLOptionElement;
    cyclistOption.selected = true;
    fireEvent.change(circles);
    fireEvent.click(screen.getByRole('button', { name: 'Count recipients' }));

    await waitFor(() =>
      expect(
        mockedNewsletterApi.previewNewsletterAudience,
      ).toHaveBeenCalledWith({
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

  it('uses the displayed location defaults and blocks counting after clearing them', async () => {
    mockedNewsletterApi.previewNewsletterAudience.mockResolvedValueOnce({
      count: 2,
    });
    render(<AdminNewsletter />);

    const location = screen.getByLabelText('Location name');
    const latitude = screen.getByLabelText('Latitude');
    const longitude = screen.getByLabelText('Longitude');
    expect(location).toHaveValue('Berlin');
    expect(location).toHaveAttribute('placeholder', 'Enter a city or region');
    expect(latitude).toHaveValue(52.52);
    expect(longitude).toHaveValue(13.405);
    expect(screen.getByLabelText('Radius (kilometres)')).toHaveValue(50);
    expect(latitude).not.toHaveAttribute('placeholder');
    expect(longitude).not.toHaveAttribute('placeholder');

    await waitFor(() =>
      expect(
        mockedNewsletterApi.previewNewsletterAudience,
      ).toHaveBeenCalledWith({
        circleIds: [],
        latitude: '52.5200',
        locationText: 'Berlin',
        longitude: '13.4050',
        radiusKm: '50',
        sources: ['from', 'hosting', 'living'],
      }),
    );
    mockedNewsletterApi.previewNewsletterAudience.mockClear();

    for (const field of [location, latitude, longitude]) {
      fireEvent.change(field, { target: { value: '' } });
      expect(field).toBeRequired();
      expect(field).toBeInvalid();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Count recipients' }));
    expect(
      mockedNewsletterApi.previewNewsletterAudience,
    ).not.toHaveBeenCalled();
  });

  it('automatically refreshes the count after valid filters change', async () => {
    mockedNewsletterApi.previewNewsletterAudience.mockResolvedValueOnce({
      count: 3,
    });
    render(<AdminNewsletter />);

    fireEvent.click(screen.getByLabelText('Hosting location'));
    fireEvent.change(screen.getByLabelText('Location name'), {
      target: { value: 'Berlin' },
    });

    expect(screen.getByText('Counting recipients…')).toBeVisible();
    await waitFor(
      () =>
        expect(
          mockedNewsletterApi.previewNewsletterAudience,
        ).toHaveBeenCalledWith(
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
    mockedTribesApi.read.mockResolvedValueOnce([
      circleSummary('5fbab4f7fed63c7ed73276d3', 'Cyclists'),
    ]);
    mockedNewsletterApi.previewNewsletterAudience.mockResolvedValueOnce({
      count: 4,
    });
    render(<AdminNewsletter />);

    fireEvent.click(screen.getByLabelText('Living location'));
    fireEvent.click(screen.getByLabelText('Origin location'));
    fireEvent.click(screen.getByLabelText('Hosting location'));
    const circles = await screen.findByLabelText('Circles (optional)');
    // The option role ensures this queried element exposes `selected`.
    const cyclistOption = (await screen.findByRole('option', {
      name: 'Cyclists',
    })) as HTMLOptionElement;
    cyclistOption.selected = true;
    fireEvent.change(circles);

    await waitFor(
      () =>
        expect(
          mockedNewsletterApi.previewNewsletterAudience,
        ).toHaveBeenCalledWith(
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
    let resolveFirst!: (preview: AudiencePreview) => void;
    let rejectSecond!: (reason?: unknown) => void;
    let resolveThird!: (preview: AudiencePreview) => void;
    mockedNewsletterApi.previewNewsletterAudience
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
        expect(
          mockedNewsletterApi.previewNewsletterAudience,
        ).toHaveBeenCalledTimes(1),
      { timeout: 1500 },
    );
    fireEvent.change(screen.getByLabelText('Location name'), {
      target: { value: 'Lisbon' },
    });
    await waitFor(
      () =>
        expect(
          mockedNewsletterApi.previewNewsletterAudience,
        ).toHaveBeenCalledTimes(2),
      { timeout: 1500 },
    );
    fireEvent.change(screen.getByLabelText('Location name'), {
      target: { value: 'Porto' },
    });
    await waitFor(
      () =>
        expect(
          mockedNewsletterApi.previewNewsletterAudience,
        ).toHaveBeenCalledTimes(3),
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
    // Preserve the malformed null payload regression case from the API.
    mockedTribesApi.read.mockResolvedValueOnce(
      null as unknown as Awaited<ReturnType<typeof tribesApi.read>>,
    );
    render(<AdminNewsletter />);

    await waitFor(() =>
      expect(mockedTribesApi.read).toHaveBeenCalledWith({ limit: 500 }),
    );
    fireEvent.click(screen.getByLabelText('Hosting location'));
    expect(screen.getByLabelText('Hosting location')).not.toBeChecked();
    expect(screen.queryByLabelText('Latitude')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Hosting location'));
    expect(screen.getByLabelText('Hosting location')).toBeChecked();
    expect(screen.getByLabelText('Latitude')).toBeInTheDocument();
  });

  it('previews one recipient and exports the audience CSV', async () => {
    mockedNewsletterApi.previewNewsletterAudience.mockResolvedValueOnce({
      count: 1,
    });
    mockedNewsletterApi.getNewsletterAudienceCsv.mockResolvedValueOnce(
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
      expect(mockedNewsletterApi.getNewsletterAudienceCsv).toHaveBeenCalledWith(
        expect.objectContaining({
          locationText: 'Berlin',
          sources: ['from', 'living'],
        }),
      ),
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickedAnchors[0].download).toMatch(
      /^newsletter-audience-Berlin-living-origin-\d{8}-\d{4}\.csv$/,
    );
  });

  it('clears an audience preview after criteria change', async () => {
    mockedNewsletterApi.previewNewsletterAudience.mockResolvedValueOnce({
      count: 0,
    });
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
    mockedNewsletterApi.previewNewsletterAudience
      .mockRejectedValueOnce({
        response: { data: { message: 'Choose valid criteria.' } },
      })
      .mockRejectedValueOnce(new Error('Network issue'))
      .mockRejectedValueOnce({ response: { data: {} } });
    render(<AdminNewsletter />);

    fireEvent.click(screen.getByLabelText('Living location'));
    fireEvent.click(screen.getByLabelText('Origin location'));
    fireEvent.click(screen.getByLabelText('Hosting location'));

    fireEvent.click(screen.getByRole('button', { name: 'Count recipients' }));
    expect(await screen.findByText('Choose valid criteria.')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Count recipients' }));
    expect(
      await screen.findByText('Could not preview this newsletter audience.'),
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Count recipients' }));
    expect(
      await screen.findByText('Could not preview this newsletter audience.'),
    ).toBeVisible();
  });

  it('shows circle loading and audience export errors', async () => {
    mockedTribesApi.read.mockRejectedValueOnce(new Error('Network issue'));
    mockedNewsletterApi.previewNewsletterAudience.mockResolvedValueOnce({
      count: 1,
    });
    mockedNewsletterApi.getNewsletterAudienceCsv.mockRejectedValueOnce(
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
    expect(
      mockedNewsletterApi.splitNewsletterSubscribers,
    ).not.toHaveBeenCalled();
  });

  it('exports all subscribers CSV', async () => {
    mockedNewsletterApi.getNewsletterSubscribersCsv.mockResolvedValueOnce(
      'Email Address,First Name,Last Name\nalice@example.com,Alice,Example',
    );
    render(<AdminNewsletter />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Export all subscribers CSV' }),
    );

    await waitFor(() =>
      expect(
        mockedNewsletterApi.getNewsletterSubscribersCsv,
      ).toHaveBeenCalledTimes(1),
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
      mockedNewsletterApi.getNewsletterCircleSubscribersCsv,
    ).not.toHaveBeenCalled();
  });

  it('exports circle subscribers CSV', async () => {
    mockedNewsletterApi.getNewsletterCircleSubscribersCsv.mockResolvedValueOnce(
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
        mockedNewsletterApi.getNewsletterCircleSubscribersCsv,
      ).toHaveBeenCalledWith('5fbab4f7fed63c7ed73276d3'),
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('uploads and shows download actions for both CSV outputs', async () => {
    mockedNewsletterApi.splitNewsletterSubscribers.mockResolvedValueOnce({
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
      expect(
        mockedNewsletterApi.splitNewsletterSubscribers,
      ).toHaveBeenCalledWith(file),
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
    mockedNewsletterApi.splitNewsletterSubscribers.mockResolvedValueOnce({
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
    mockedNewsletterApi.splitNewsletterSubscribers.mockRejectedValueOnce({
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
    mockedNewsletterApi.splitNewsletterSubscribers.mockRejectedValueOnce(
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
    expect(
      mockedNewsletterApi.splitNewsletterSubscribers,
    ).not.toHaveBeenCalled();
  });

  it('shows API error text when export fails', async () => {
    mockedNewsletterApi.getNewsletterSubscribersCsv.mockRejectedValueOnce({
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
    mockedNewsletterApi.getNewsletterSubscribersCsv.mockRejectedValueOnce(
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
    mockedNewsletterApi.getNewsletterCircleSubscribersCsv.mockRejectedValueOnce(
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
