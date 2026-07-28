import axios from 'axios';

import {
  getNewsletterCircleSubscribersCsv,
  getNewsletterSubscribersCsv,
  splitNewsletterSubscribers,
} from '@/modules/admin/client/api/newsletter.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('admin newsletter api', () => {
  it('fetches all subscribers CSV export', async () => {
    const data =
      'Email Address,First Name,Last Name\nalice@example.com,Alice,Example';
    axios.get.mockResolvedValueOnce({ data });

    await expect(getNewsletterSubscribersCsv()).resolves.toEqual(data);
    expect(axios.get).toHaveBeenCalledWith(
      '/api/admin/newsletter-subscribers',
      {
        responseType: 'text',
      },
    );
  });

  it('fetches circle subscribers CSV export', async () => {
    const data =
      'Email Address,First Name,Last Name\nalice@example.com,Alice,Example';
    axios.get.mockResolvedValueOnce({ data });

    await expect(
      getNewsletterCircleSubscribersCsv('5fbab4f7fed63c7ed73276d3'),
    ).resolves.toEqual(data);
    expect(axios.get).toHaveBeenCalledWith(
      '/api/admin/newsletter-subscribers/circle',
      {
        params: { circleId: '5fbab4f7fed63c7ed73276d3' },
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
      subscribedCount: 1,
      subscribedCsv:
        'Email Address,First Name,Last Name\nalice@example.com,Alice,Example',
      totalEmailCount: 1,
      unsubscribedCount: 0,
      unsubscribedCsv: 'Email Address,First Name,Last Name',
    };
    axios.post.mockResolvedValueOnce({ data });

    await expect(splitNewsletterSubscribers(file)).resolves.toEqual(data);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      '/api/admin/newsletter-subscribers/split',
      expect.any(FormData),
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
  });
});
