import httpClient from '@/modules/core/client/api/http-client';
import { getVolunteers } from '@/modules/pages/client/api/volunteers.api';
import { get as getStatistics } from '@/modules/statistics/client/api/statistics.api';

describe('public TypeScript APIs use the configured HTTP client', () => {
  const originalAdapter = httpClient.defaults.adapter;
  const originalTimeout = httpClient.defaults.timeout;
  let adapter;

  beforeEach(() => {
    adapter = jest.fn(async config => ({
      config,
      data: { volunteers: [], alumni: [], total: 12 },
      headers: {},
      status: 200,
      statusText: 'OK',
    }));
    httpClient.defaults.adapter = adapter;
    httpClient.defaults.timeout = 45000;
  });

  afterEach(() => {
    httpClient.defaults.adapter = originalAdapter;
    httpClient.defaults.timeout = originalTimeout;
  });

  it.each([
    [getVolunteers, '/api/volunteers'],
    [getStatistics, '/api/statistics'],
  ])('inherits shared request defaults for %s', async (request, url) => {
    await request();

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[0][0]).toMatchObject({
      method: 'get',
      timeout: 45000,
      url,
    });
    expect(
      adapter.mock.calls[0][0].headers.get('X-Trustroots-Request'),
    ).toBeUndefined();
  });
});
