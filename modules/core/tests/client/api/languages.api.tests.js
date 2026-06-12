import axios from 'axios';

import { useLanguagesQuery } from '@/modules/core/client/api/languages.api';

jest.mock('axios');

const mockUseQuery = jest.fn();
jest.mock('react-query', () => ({
  useQuery: (...args) => mockUseQuery(...args),
}));

afterEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockReset();
});

describe('languages api', () => {
  it('loads object format by default', async () => {
    const payload = [
      { value: 'eng', label: 'English' },
      { value: 'fin', label: 'Finnish' },
    ];
    mockUseQuery.mockImplementation((queryKey, queryFn, queryOptions) => {
      return { queryKey, queryFn, queryOptions };
    });
    axios.get.mockResolvedValueOnce({ data: payload });

    const result = useLanguagesQuery();
    const [queryKey, queryFn, queryOptions] = mockUseQuery.mock.calls[0];

    expect(queryKey).toEqual(['languages', 'object']);
    expect(queryOptions).toEqual({ refetchOnWindowFocus: false });
    await expect(queryFn()).resolves.toEqual(payload);
    expect(axios.get).toHaveBeenCalledWith('/api/languages?format=object');
    expect(queryFn).toBe(result.queryFn);
  });

  it('loads array format when requested', async () => {
    const payload = ['English', 'Finnish'];
    mockUseQuery.mockImplementation((queryKey, queryFn, queryOptions) => {
      return { queryKey, queryFn, queryOptions };
    });
    axios.get.mockResolvedValueOnce({ data: payload });

    const result = useLanguagesQuery({ format: 'array' });
    const [queryKey, queryFn, queryOptions] = mockUseQuery.mock.calls[0];

    expect(queryKey).toEqual(['languages', 'array']);
    expect(queryOptions).toEqual({ refetchOnWindowFocus: false });
    await expect(queryFn()).resolves.toEqual(payload);
    expect(axios.get).toHaveBeenCalledWith('/api/languages?format=array');
    expect(queryFn).toBe(result.queryFn);
  });

  it('forwards request failures', async () => {
    const networkError = new Error('network failed');
    mockUseQuery.mockImplementation((queryKey, queryFn, queryOptions) => {
      return { queryKey, queryFn, queryOptions };
    });
    axios.get.mockRejectedValue(networkError);

    const { queryFn } = useLanguagesQuery();
    await expect(queryFn()).rejects.toBe(networkError);
  });
});
