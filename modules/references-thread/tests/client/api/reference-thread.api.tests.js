import axios from 'axios';

import {
  get,
  send,
} from '@/modules/references-thread/client/api/reference-thread.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('reference-thread api', () => {
  it('gets a reference thread for a user', async () => {
    const data = { _id: 'ref-1' };
    axios.get.mockResolvedValueOnce({ data });

    await expect(get('user-1')).resolves.toBe(data);
    expect(axios.get).toHaveBeenCalledWith('/api/references-thread/user-1');
  });

  it('sends a reference thread answer', async () => {
    const data = { _id: 'ref-1' };
    axios.post.mockResolvedValueOnce({ data });

    await expect(send('yes', 'user-1')).resolves.toBe(data);
    expect(axios.post).toHaveBeenCalledWith('/api/references-thread', {
      reference: 'yes',
      userTo: 'user-1',
    });
  });
});
