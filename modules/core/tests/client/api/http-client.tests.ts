import { AxiosHeaders, type AxiosAdapter } from 'axios';
import { viewNavigation } from '../../../client/services/member-view';

import httpClient, {
  getErrorMessage,
  getErrorResponse,
} from '@/modules/core/client/api/http-client';

describe('shared module HTTP client', () => {
  afterEach(() => {
    delete window.viewContext;
    jest.restoreAllMocks();
  });
  it('binds reads and lifecycle writes to the current view and rejects member mutations locally', async () => {
    window.viewContext = {
      generation: 'example-generation',
      username: 'examplemember',
    };
    const adapter: AxiosAdapter = jest.fn(async config => ({
      config,
      data: {},
      headers: new AxiosHeaders(),
      status: 200,
      statusText: 'OK',
    }));
    await httpClient.get('/api/messages', { adapter });
    await httpClient.post('/api/auth/masquerade/stop', {}, { adapter });
    await expect(httpClient.put('/api/users', {}, { adapter })).rejects.toThrow(
      'read-only',
    );
    await expect(
      httpClient.request({ method: 'post', adapter }),
    ).rejects.toThrow('read-only');
    const calls = jest.mocked(adapter).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0].headers.get('X-Trustroots-View')).toBe(
      'example-generation',
    );
    window.viewContext = { generation: 'restored-generation' };
    await httpClient.put('/api/users', {}, { adapter });
  });
  it('reloads a stale context without retrying the failed request', async () => {
    const reload = jest
      .spyOn(viewNavigation, 'reload')
      .mockImplementation(() => {});
    const error = { response: { data: { code: 'VIEW_CONTEXT_CHANGED' } } };
    const adapter: AxiosAdapter = jest.fn(async () => {
      throw error;
    });
    await expect(httpClient.get('/api/messages', { adapter })).rejects.toBe(
      error,
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(1);
    const expired = { response: { data: { code: 'VIEW_EXPIRED' } } };
    await expect(
      httpClient.get('/api/messages', {
        adapter: async () => {
          throw expired;
        },
      }),
    ).rejects.toBe(expired);
    expect(reload).toHaveBeenCalledTimes(2);
    await expect(
      httpClient.get('/api/messages', {
        adapter: async () => {
          throw new Error('offline');
        },
      }),
    ).rejects.toThrow('offline');
  });
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
});
