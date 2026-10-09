import {
  cancelAdminPassword,
  isAdminElevationPending,
  requestAdminPassword,
  submitAdminPassword,
  registerAdminElevationInterceptor,
} from '@/modules/admin/client/api/admin-elevation';

jest.mock('@/modules/core/client/api/http-client', () => {
  const mockResponseHandlers = [];
  const mockAxios = jest.fn();
  mockAxios.post = jest.fn();
  mockAxios.interceptors = {
    response: {
      use: jest.fn((fulfilled, rejected) => {
        mockResponseHandlers.push({ fulfilled, rejected });
      }),
    },
  };
  mockAxios.mockResponseHandlers = mockResponseHandlers;

  return {
    __esModule: true,
    default: mockAxios,
    getErrorResponse: error => error.response,
  };
});

const mockAxios = jest.requireMock(
  '@/modules/core/client/api/http-client',
).default;
const mockResponseHandlers = mockAxios.mockResponseHandlers;

describe('admin elevation api helper', () => {
  afterEach(() => {
    cancelAdminPassword();
    mockAxios.mockReset();
    mockAxios.post.mockReset();
    mockAxios.interceptors.response.use.mockClear();
  });

  it('resolves a pending password prompt', async () => {
    const pending = requestAdminPassword();
    expect(isAdminElevationPending()).toBe(true);
    submitAdminPassword('ExamplePassword123!');
    await expect(pending).resolves.toBe('ExamplePassword123!');
    expect(isAdminElevationPending()).toBe(false);
  });

  it('rejects when the password prompt is cancelled', async () => {
    const pending = requestAdminPassword();
    cancelAdminPassword();
    await expect(pending).rejects.toThrow('Admin confirmation cancelled.');
  });

  it('registers the interceptor once and returns successful responses', () => {
    registerAdminElevationInterceptor();
    registerAdminElevationInterceptor();

    expect(mockAxios.interceptors.response.use).toHaveBeenCalledTimes(1);
    expect(mockResponseHandlers[0].fulfilled({ data: 'ok' })).toEqual({
      data: 'ok',
    });
  });

  it('elevates and retries a protected admin request', async () => {
    registerAdminElevationInterceptor();
    const config = { url: '/api/admin/users' };
    const retryResult = { data: 'retried' };
    mockAxios.mockResolvedValue(retryResult);
    mockAxios.post.mockResolvedValue({});

    const request = mockResponseHandlers[0].rejected({
      config,
      response: { status: 403, data: { code: 'ADMIN_ELEVATION_REQUIRED' } },
    });
    await Promise.resolve();
    expect(isAdminElevationPending()).toBe(true);
    submitAdminPassword('ExamplePassword123!');

    await expect(request).resolves.toBe(retryResult);
    expect(mockAxios.post).toHaveBeenCalledWith('/api/admin/elevate', {
      password: 'ExamplePassword123!',
    });
    expect(config.__adminElevationRetried).toBe(true);
    expect(mockAxios).toHaveBeenCalledWith(config);
  });

  it('shares one password prompt for concurrent admin requests', async () => {
    registerAdminElevationInterceptor();
    const retryResult = { data: 'retried' };
    mockAxios.mockResolvedValue(retryResult);
    mockAxios.post.mockResolvedValue({});
    const first = mockResponseHandlers[0].rejected({
      config: { url: '/api/admin/users' },
      response: { status: 403, data: { code: 'ADMIN_ELEVATION_REQUIRED' } },
    });
    const second = mockResponseHandlers[0].rejected({
      config: { url: '/api/admin/threads' },
      response: { status: 403, data: { code: 'ADMIN_ELEVATION_REQUIRED' } },
    });
    await Promise.resolve();

    expect(isAdminElevationPending()).toBe(true);
    submitAdminPassword('ExamplePassword123!');

    await expect(Promise.all([first, second])).resolves.toEqual([
      retryResult,
      retryResult,
    ]);
    expect(mockAxios.post).toHaveBeenCalledTimes(1);
  });

  it.each([
    { response: { status: 401, data: { code: 'ADMIN_ELEVATION_REQUIRED' } } },
    {
      config: { url: '' },
      response: { status: 403, data: { code: 'ADMIN_ELEVATION_REQUIRED' } },
    },
    { response: { status: 403, data: { code: 'OTHER' } } },
    {
      config: { url: '/api/admin/elevate' },
      response: { status: 403, data: { code: 'ADMIN_ELEVATION_REQUIRED' } },
    },
    {
      config: { url: '/api/users/profile' },
      response: { status: 403, data: { code: 'ADMIN_ELEVATION_REQUIRED' } },
    },
    {
      config: { url: '/api/admin/users', __adminElevationRetried: true },
      response: { status: 403, data: { code: 'ADMIN_ELEVATION_REQUIRED' } },
    },
  ])('passes through unrelated or repeated errors', async error => {
    registerAdminElevationInterceptor();

    await expect(mockResponseHandlers[0].rejected(error)).rejects.toBe(error);
  });

  it('passes through password cancellation and elevation failures', async () => {
    registerAdminElevationInterceptor();
    const error = {
      config: { url: '/api/admin/users' },
      response: { status: 403, data: { code: 'ADMIN_ELEVATION_REQUIRED' } },
    };
    const cancelledRequest = mockResponseHandlers[0].rejected(error);
    await Promise.resolve();
    cancelAdminPassword();
    await expect(cancelledRequest).rejects.toThrow(
      'Admin confirmation cancelled.',
    );

    await new Promise(resolve => setTimeout(resolve, 0));
    mockAxios.post.mockRejectedValue(new Error('Invalid password.'));
    const failedElevation = mockResponseHandlers[0].rejected({
      config: { url: '/api/admin/users' },
      response: { status: 403, data: { code: 'ADMIN_ELEVATION_REQUIRED' } },
    });
    await Promise.resolve();
    submitAdminPassword('wrong');
    await expect(failedElevation).rejects.toThrow('Invalid password.');
  });
});
