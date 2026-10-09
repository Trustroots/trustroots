import axios from 'axios';

import {
  useLanguagesQuery,
  type LanguageOption,
} from '@/modules/core/client/api/languages.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

const mockUseQuery = jest.fn();
jest.mock('react-query', () => ({
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
    const payload: LanguageOption[] = [
      { value: 'eng', label: 'English' },
      { value: 'fin', label: 'Finnish' },
    ];
    mockUseQuery.mockImplementation(
      (queryKey: unknown, queryFn: QueryFn, queryOptions: unknown) => ({
        queryKey,
        queryFn,
        queryOptions,
      }),
    );
    mockedAxios.get.mockResolvedValueOnce({ data: payload });

    const result = useLanguagesQuery() as unknown as {
      queryFn: QueryFn;
    };
    const [queryKey, queryFn, queryOptions] = mockUseQuery.mock.calls[0] as [
      unknown,
      QueryFn,
      unknown,
    ];

    expect(queryKey).toEqual(['languages', 'object']);
    expect(queryOptions).toEqual({ refetchOnWindowFocus: false });
    await expect(queryFn()).resolves.toEqual(payload);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      '/api/languages?format=object',
    );
    expect(queryFn).toBe(result.queryFn);
  });

  it('loads array format when requested', async () => {
    const payload: LanguageOption[] = [
      { value: 'eng', label: 'English' },
      { value: 'fin', label: 'Finnish' },
    ];
    mockUseQuery.mockImplementation(
      (queryKey: unknown, queryFn: QueryFn, queryOptions: unknown) => ({
        queryKey,
        queryFn,
        queryOptions,
      }),
    );
    mockedAxios.get.mockResolvedValueOnce({ data: payload });

    const result = useLanguagesQuery({ format: 'array' }) as unknown as {
      queryFn: QueryFn;
    };
    const [queryKey, queryFn, queryOptions] = mockUseQuery.mock.calls[0] as [
      unknown,
      QueryFn,
      unknown,
    ];

    expect(queryKey).toEqual(['languages', 'array']);
    expect(queryOptions).toEqual({ refetchOnWindowFocus: false });
    await expect(queryFn()).resolves.toEqual(payload);
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/languages?format=array');
    expect(queryFn).toBe(result.queryFn);
  });

  it('forwards request failures', async () => {
    const networkError = new Error('network failed');
    mockUseQuery.mockImplementation(
      (queryKey: unknown, queryFn: QueryFn, queryOptions: unknown) => ({
        queryKey,
        queryFn,
        queryOptions,
      }),
    );
    mockedAxios.get.mockRejectedValue(networkError);

    const { queryFn } = useLanguagesQuery() as unknown as { queryFn: QueryFn };
    await expect(queryFn()).rejects.toBe(networkError);
  });
});
