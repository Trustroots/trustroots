import httpClient, {
  getErrorResponse,
} from '@/modules/core/client/api/http-client';

describe('shared module HTTP client', () => {
  it('uses a finite default timeout', () => {
    expect(httpClient.defaults.timeout).toBe(15000);
  });

  it('passes per-request timeout and headers to Axios', async () => {
    const response = { ok: true };
    const adapter = jest.fn(async config => ({
      config,
      data: response,
      headers: {},
      status: 200,
      statusText: 'OK',
    }));

    await expect(
      httpClient.get('/api/example', {
        adapter,
        headers: { 'X-Request-Option': 'provided' },
        timeout: 30000,
      }),
    ).resolves.toMatchObject({ data: response });

    expect(adapter.mock.calls[0][0]).toMatchObject({
      headers: { 'X-Request-Option': 'provided' },
      timeout: 30000,
    });
  });

  it('honours AbortSignal cancellation', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      httpClient.get('/api/example', { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'ERR_CANCELED' });
  });

  it('returns a response from an Axios error without wrapping it', () => {
    const response = { data: { message: 'Unavailable' }, status: 503 };
    const error = { response };

    expect(getErrorResponse(error)).toBe(response);
    expect(getErrorResponse(new Error('No response'))).toBeUndefined();
  });
});
