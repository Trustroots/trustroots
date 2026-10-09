import axios from 'axios';

import {
  getVolunteers,
  type VolunteersResponse,
} from '@/modules/pages/client/api/volunteers.api';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

afterEach(() => {
  jest.clearAllMocks();
});

describe('volunteers api', () => {
  it('fetches volunteers', async () => {
    const data: VolunteersResponse = {
      volunteers: [
        { _id: 'volunteer-1', firstName: 'Alex', username: 'sample-helper' },
      ],
      alumni: [],
    };
    // The shared Axios test double only supplies the data field this API reads.
    const getMock = axios.get as jest.MockedFunction<
      (url: string) => Promise<{ data: VolunteersResponse }>
    >;
    getMock.mockResolvedValueOnce({ data });

    await expect(getVolunteers()).resolves.toBe(data);
    expect(axios.get).toHaveBeenCalledWith('/api/volunteers');
  });
});
