import axios from 'axios';

import { reportMember, send } from '@/modules/support/client/api/support.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('support api', () => {
  it('sends a support request', async () => {
    const request = { message: 'Help me' };
    const response = { data: { ok: true } };
    axios.post.mockResolvedValueOnce(response);

    await expect(send(request)).resolves.toBe(response);
    expect(axios.post).toHaveBeenCalledWith('/api/support', request);
  });

  it('reports a member through support', async () => {
    axios.post.mockResolvedValueOnce({});

    await reportMember({ username: 'samplemember' }, 'A report');
    expect(axios.post).toHaveBeenCalledWith('/api/support', {
      message: 'A report',
      reportMember: 'samplemember',
    });
  });
});
