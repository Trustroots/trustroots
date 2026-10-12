import { AxiosHeaders, type AxiosAdapter } from 'axios';

import httpClient, {
  getErrorResponse,
} from '@/modules/core/client/api/http-client';

describe('shared module HTTP client', () => {
  it('uses a finite default timeout', () => {
    expect(httpClient.defaults.timeout).toBe(120000);
  });

  it('passes per-request timeout and headers to Axios', async () => {
    const response = { ok: true };
    const adapter = jest.fn<ReturnType<AxiosAdapter>, Parameters<AxiosAdapter>>(
      async config => ({
        config,
        data: response,
        headers: new AxiosHeaders(),
        status: 200,
        statusText: 'OK',
      }),
    );

    await expect(
      httpClient.get('/api/example', {
        adapter,
        headers: { 'X-Request-Option': 'provided' },
        timeout: 30000,
      }),
    ).resolves.toMatchObject({ data: response });

    expect(adapter.mock.calls[0]?.[0]).toMatchObject({
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

  it.each(['POST', 'put', 'PATCH', 'delete'])(
    'marks %s API mutations while preserving caller headers',
    async (method: string) => {
      const adapter = jest.fn<
        ReturnType<AxiosAdapter>,
        Parameters<AxiosAdapter>
      >(async config => ({
        config,
        data: {},
        headers: new AxiosHeaders(),
        status: 200,
        statusText: 'OK',
      }));

      await httpClient.request({
        url: '/api/example',
        method,
        adapter,
        headers: { 'X-Request-Option': 'provided' },
      });

      const headers = adapter.mock.calls[0]?.[0].headers;
      expect(headers).toBeDefined();
      expect(headers.get('X-Trustroots-Request')).toBe('1');
      expect(headers.get('X-Request-Option')).toBe('provided');
    },
  );

  it('leaves safe HEAD requests without the mutation marker', async () => {
    const adapter = jest.fn<ReturnType<AxiosAdapter>, Parameters<AxiosAdapter>>(
      async config => ({
        config,
        data: {},
        headers: new AxiosHeaders(),
        status: 200,
        statusText: 'OK',
      }),
    );

    await httpClient.head('/api/example', { adapter });

    expect(
      adapter.mock.calls[0]?.[0].headers.get('X-Trustroots-Request'),
    ).toBeUndefined();
  });

  it.each([false, 'caller-value'])(
    'sets the required mutation marker when a caller supplies %s',
    async (marker: string | boolean) => {
      const adapter = jest.fn<
        ReturnType<AxiosAdapter>,
        Parameters<AxiosAdapter>
      >(async config => ({
        config,
        data: {},
        headers: new AxiosHeaders(),
        status: 200,
        statusText: 'OK',
      }));

      await httpClient.post(
        '/api/example',
        {},
        {
          adapter,
          headers: {
            'x-trustroots-request': marker,
            'X-Request-Option': 'provided',
          },
        },
      );

      const headers = adapter.mock.calls[0]?.[0].headers;
      expect(headers).toBeDefined();
      expect(headers.get('X-Trustroots-Request')).toBe('1');
      expect(headers.get('X-Request-Option')).toBe('provided');
    },
  );

  it('returns a response from an Axios error without wrapping it', () => {
    const response = { data: { message: 'Unavailable' }, status: 503 };
    const error = { response };

    expect(getErrorResponse(error)).toBe(response);
    expect(getErrorResponse(new Error('No response'))).toBeUndefined();
  });
});
