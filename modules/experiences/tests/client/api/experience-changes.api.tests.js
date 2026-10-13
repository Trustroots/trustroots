import axios from 'axios';
import * as api from '@/modules/experiences/client/api/experience-changes.api';

jest.mock('axios');

afterEach(() => jest.clearAllMocks());

it('keeps the support secret in a header rather than an API URL', async () => {
  axios.get.mockResolvedValueOnce({ data: { canEdit: true } });
  axios.get.mockResolvedValueOnce({ data: { status: 'pending' } });
  axios.post.mockResolvedValueOnce({ data: { status: 'pending' } });

  await expect(api.readAccess('experience-1', 'secret-1')).resolves.toEqual({
    canEdit: true,
  });
  await expect(api.readMine('experience-1')).resolves.toEqual({
    status: 'pending',
  });
  await expect(
    api.submit('experience-1', 'secret-1', { kind: 'remove' }),
  ).resolves.toEqual({ status: 'pending' });

  expect(axios.get).toHaveBeenNthCalledWith(
    1,
    '/api/experiences/experience-1/change-access',
    { headers: { 'X-Experience-Change-Secret': 'secret-1' } },
  );
  expect(axios.get).toHaveBeenNthCalledWith(
    2,
    '/api/experiences/experience-1/change-requests/mine',
  );
  expect(axios.post).toHaveBeenCalledWith(
    '/api/experiences/experience-1/change-requests',
    { kind: 'remove' },
    { headers: { 'X-Experience-Change-Secret': 'secret-1' } },
  );
});
