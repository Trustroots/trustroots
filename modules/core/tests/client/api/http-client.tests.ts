import { AxiosHeaders, type AxiosAdapter } from 'axios';

import httpClient, {
  describeRequestFailure,
  getErrorMessage,
  getErrorResponse,
  onRequestFailure,
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

  it('uses an API response message or the caller fallback', () => {
    expect(
      getErrorMessage(
        { response: { data: { message: 'Request rejected.' } } },
        'Request failed.',
      ),
    ).toBe('Request rejected.');
    expect(getErrorMessage({}, 'Request failed.')).toBe('Request failed.');
    expect(getErrorMessage({ response: {} }, 'Request failed.')).toBe(
      'Request failed.',
    );
    expect(
      getErrorMessage(
        { response: { data: { message: '' } } },
        'Request failed.',
      ),
    ).toBe('Request failed.');
    expect(getErrorMessage(new Error('Network issue'), 'Request failed.')).toBe(
      'Request failed.',
    );
  });

  it('reduces a failed request to its status, method and API area', () => {
    expect(
      describeRequestFailure({
        config: { method: 'POST', url: '/api/users/some-member?x=1' },
        response: { status: 422 },
      }),
    ).toEqual({ status: 422, method: 'post', area: 'users' });
    expect(
      describeRequestFailure({ config: { method: 'get', url: '/api/offers' } }),
    ).toEqual({ status: 0, method: 'get', area: 'offers' });
    expect(
      describeRequestFailure({
        config: { method: 'options', url: 'https://example.org/api/x' },
      }),
    ).toEqual({ status: 0, method: 'other', area: 'external' });
    expect(describeRequestFailure(new Error('offline'))).toEqual({
      status: 0,
      method: 'other',
      area: 'external',
    });
    expect(describeRequestFailure(null)).toEqual({
      status: 0,
      method: 'other',
      area: 'external',
    });
  });

  it('tells subscribers about failed requests until they unsubscribe', async () => {
    const listener = jest.fn();
    const unsubscribe = onRequestFailure(listener);
    const adapter: AxiosAdapter = async config => {
      throw Object.assign(new Error('Unavailable'), {
        config,
        response: { status: 503 },
      });
    };

    await expect(
      httpClient.get('/api/messages/thread-id', { adapter }),
    ).rejects.toThrow('Unavailable');
    expect(listener).toHaveBeenCalledWith({
      status: 503,
      method: 'get',
      area: 'messages',
    });

    unsubscribe();
    await expect(httpClient.get('/api/messages', { adapter })).rejects.toThrow(
      'Unavailable',
    );
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('skips expected statuses and requests without a response', async () => {
    const listener = jest.fn();
    const unsubscribe = onRequestFailure(listener);
    const failWith =
      (failure: object): AxiosAdapter =>
      async () => {
        throw failure;
      };

    await expect(
      httpClient.get('/api/offers-by/someone', {
        adapter: async config => {
          throw Object.assign(new Error('Not found'), {
            config,
            response: { status: 404 },
          });
        },
        expectedStatuses: [404],
      }),
    ).rejects.toMatchObject({ response: { status: 404 } });
    await expect(
      httpClient.get('/api/messages-count', {
        adapter: failWith(new Error('Network Error')),
      }),
    ).rejects.toThrow('Network Error');
    expect(listener).not.toHaveBeenCalled();

    await expect(
      httpClient.get('/api/offers-by/someone', {
        adapter: failWith({ response: { status: 500 } }),
      }),
    ).rejects.toMatchObject({ response: { status: 500 } });
    expect(listener).toHaveBeenCalledWith({
      status: 500,
      method: 'other',
      area: 'external',
    });

    const adapter: AxiosAdapter = async config => {
      throw Object.assign(new Error('Server error'), {
        config,
        response: { status: 500 },
      });
    };
    await expect(
      httpClient.get('/api/offers-by/someone', {
        adapter,
        expectedStatuses: [404],
      }),
    ).rejects.toMatchObject({ response: { status: 500 } });
    expect(listener).toHaveBeenLastCalledWith({
      status: 500,
      method: 'get',
      area: 'offers-by',
    });
    unsubscribe();
  });

  it('does not report cancelled requests', async () => {
    const listener = jest.fn();
    const unsubscribe = onRequestFailure(listener);
    const controller = new AbortController();
    controller.abort();

    await expect(
      httpClient.get('/api/example', { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
