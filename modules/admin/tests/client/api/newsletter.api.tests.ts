import axios, { type AxiosResponse } from 'axios';

import {
  getNewsletterAudienceCsv,
  getNewsletterCircleSubscribersCsv,
  getNewsletterSubscribersCsv,
  previewNewsletterAudience,
  splitNewsletterSubscribers,
  type NewsletterAudienceCriteria,
} from '@/modules/admin/client/api/newsletter.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

const axiosMock = jest.mocked(axios);

function response<T>(data: T): AxiosResponse<T> {
  const { AxiosHeaders: ActualAxiosHeaders } =
    jest.requireActual<typeof import('axios')>('axios');
  const headers = new ActualAxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('admin newsletter api', () => {
  it('fetches all subscribers CSV export', async () => {
    const data =
      'Email Address,First Name,Last Name\nalice@example.com,Alice,Example';
    axiosMock.get.mockResolvedValueOnce(response(data));

    await expect(getNewsletterSubscribersCsv()).resolves.toEqual(data);
    expect(axiosMock.get).toHaveBeenCalledWith(
      '/api/admin/newsletter-subscribers',
      {
        responseType: 'text',
      },
    );
  });

  it('fetches circle subscribers CSV export', async () => {
    const data =
      'Email Address,First Name,Last Name\nalice@example.com,Alice,Example';
    axiosMock.get.mockResolvedValueOnce(response(data));

    await expect(
      getNewsletterCircleSubscribersCsv('5fbab4f7fed63c7ed73276d3'),
    ).resolves.toEqual(data);
    expect(axiosMock.get).toHaveBeenCalledWith(
      '/api/admin/newsletter-subscribers/circle',
      {
        params: { circleId: '5fbab4f7fed63c7ed73276d3' },
        responseType: 'text',
      },
    );
  });

  it('previews a targeted audience', async () => {
    const criteria: NewsletterAudienceCriteria = {
      circleIds: [],
      latitude: '52.52',
      locationText: 'Berlin',
      longitude: '13.405',
      radiusKm: '25',
      sources: ['living', 'from'],
    };
    const preview = { count: 12 };
    axiosMock.post.mockResolvedValueOnce(response(preview));

    await expect(previewNewsletterAudience(criteria)).resolves.toEqual(preview);
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/admin/newsletter-subscribers/audience',
      {
        ...criteria,
        format: 'preview',
      },
    );
  });

  it('exports a targeted audience CSV', async () => {
    const criteria: NewsletterAudienceCriteria = {
      circleIds: ['5fbab4f7fed63c7ed73276d3'],
      latitude: '52.52',
      locationText: 'Berlin',
      longitude: '13.405',
      radiusKm: '25',
      sources: [],
    };
    const data =
      'Email Address,First Name,Last Name\nalice@example.com,Alice,Example';
    axiosMock.post.mockResolvedValueOnce(response(data));

    await expect(getNewsletterAudienceCsv(criteria)).resolves.toEqual(data);
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/admin/newsletter-subscribers/audience',
      {
        ...criteria,
        format: 'csv',
      },
      {
        responseType: 'text',
      },
    );
  });

  it('uploads CSV file for subscriber split', async () => {
    const file = new File(
      ['Email Address\nalice@example.com'],
      'newsletter.csv',
      {
        type: 'text/csv',
      },
    );
    const data = {
      outputFormat: 'csv',
      subscribedCount: 1,
      subscribedContent:
        'Email Address,First Name,Last Name\nalice@example.com,Alice,Example',
      totalEmailCount: 1,
      unsubscribedCount: 0,
      unsubscribedContent: 'Email Address,First Name,Last Name',
    };
    axiosMock.post.mockResolvedValueOnce(response(data));

    await expect(splitNewsletterSubscribers(file)).resolves.toEqual(data);
    expect(axiosMock.post).toHaveBeenCalledTimes(1);
    expect(axiosMock.post).toHaveBeenCalledWith(
      '/api/admin/newsletter-subscribers/split',
      expect.any(FormData),
      {
        timeout: 120000,
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Trustroots-Request': '1',
        },
      },
    );
  });
});
