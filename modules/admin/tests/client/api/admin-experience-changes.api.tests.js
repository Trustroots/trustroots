import axios from 'axios';
import * as api from '@/modules/admin/client/api/admin-experience-changes.api';

jest.mock('axios');

afterEach(() => jest.clearAllMocks());

it('uses the admin-only lookup, link, queue, and decision APIs', async () => {
  axios.get.mockResolvedValueOnce({ data: [{ _id: 'experience-1' }] });
  axios.post.mockResolvedValueOnce({ data: { path: '/change?secret=one' } });
  axios.get.mockResolvedValueOnce({ data: [{ _id: 'request-1' }] });
  axios.post.mockResolvedValueOnce({ data: { status: 'approved' } });

  await expect(api.findExperiences('member-one')).resolves.toHaveLength(1);
  await expect(
    api.issueLink('experience-1', 'member-1'),
  ).resolves.toHaveProperty('path');
  await expect(api.listRequests()).resolves.toHaveLength(1);
  await expect(api.decide('request-1', 'approve')).resolves.toHaveProperty(
    'status',
    'approved',
  );

  expect(axios.get).toHaveBeenNthCalledWith(1, '/api/admin/experiences', {
    params: { username: 'member-one' },
  });
  expect(axios.post).toHaveBeenNthCalledWith(
    1,
    '/api/admin/experiences/experience-1/change-links',
    { memberId: 'member-1' },
  );
  expect(axios.get).toHaveBeenNthCalledWith(
    2,
    '/api/admin/experience-change-requests',
  );
  expect(axios.post).toHaveBeenNthCalledWith(
    2,
    '/api/admin/experience-change-requests/request-1/decision',
    { decision: 'approve' },
  );
});
