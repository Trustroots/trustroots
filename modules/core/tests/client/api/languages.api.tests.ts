import axios from 'axios';

import {
  useLanguagesQuery,
  type LanguageOption,
} from '@/modules/core/client/api/languages.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock'),
);

const mockUseQuery = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

type QueryFn = () => Promise<unknown>;

afterEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockReset();
});

describe('languages api', () => {
  it('loads object format by default', async () => {
    const payload = { eng: 'English', fin: 'Finnish' };
    mockUseQuery.mockImplementation((options: unknown) => options);
    mockedAxios.get.mockResolvedValueOnce({ data: payload });

    const result = useLanguagesQuery();
    const { queryKey, queryFn, ...queryOptions } = mockUseQuery.mock
      .calls[0][0] as { queryKey: unknown; queryFn: QueryFn };

    expect(queryKey).toEqual(['languages', 'object']);
    expect(queryOptions).toEqual({ refetchOnWindowFocus: false });
    await expect(queryFn()).resolves.toEqual(payload);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      '/api/languages?format=object',
    );
    expect(queryFn).toBe(Reflect.get(result, 'queryFn'));
  });

  it('loads array format when requested', async () => {
    const payload: LanguageOption[] = [
      { value: 'eng', label: 'English' },
      { value: 'fin', label: 'Finnish' },
    ];
    mockUseQuery.mockImplementation((options: unknown) => options);
    mockedAxios.get.mockResolvedValueOnce({ data: payload });

    const result = useLanguagesQuery({ format: 'array' });
    const { queryKey, queryFn, ...queryOptions } = mockUseQuery.mock
      .calls[0][0] as { queryKey: unknown; queryFn: QueryFn };

    expect(queryKey).toEqual(['languages', 'array']);
    expect(queryOptions).toEqual({ refetchOnWindowFocus: false });
    await expect(queryFn()).resolves.toEqual(payload);
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/languages?format=array');
    expect(queryFn).toBe(Reflect.get(result, 'queryFn'));
  });

  it.each([
    { format: 'array', data: { eng: 'English' } },
    { format: 'array', data: [{ value: 'eng', label: null }] },
    {
      format: 'array',
      data: [{ value: 'eng', label: 'English', deprecated: 'false' }],
    },
    { format: 'object', data: [{ value: 'eng', label: 'English' }] },
    { format: 'object', data: { eng: null } },
    { format: 'object', data: '<html>Unexpected response</html>' },
  ] as const)(
    'rejects invalid $format responses ($data)',
    async ({ format, data }) => {
      mockUseQuery.mockImplementation((options: unknown) => options);
      mockedAxios.get.mockResolvedValueOnce({ data });

      useLanguagesQuery({ format });
      const { queryFn }: { queryFn: QueryFn } = mockUseQuery.mock.calls[0][0];
      await expect(queryFn()).rejects.toThrow(
        `Invalid language response for format "${format}"`,
      );
    },
  );

  it('forwards request failures', async () => {
    const networkError = new Error('network failed');
    mockUseQuery.mockImplementation((options: unknown) => options);
    mockedAxios.get.mockRejectedValue(networkError);

    useLanguagesQuery();
    const { queryFn }: { queryFn: QueryFn } = mockUseQuery.mock.calls[0][0];
    await expect(queryFn()).rejects.toBe(networkError);
  });
});
