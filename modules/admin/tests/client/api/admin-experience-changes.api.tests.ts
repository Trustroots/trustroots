import axios, { type AxiosResponse } from 'axios';
import * as api from '@/modules/admin/client/api/admin-experience-changes.api';
import type {
  AdminExperienceChangeDecisionResult,
  AdminExperienceChangeLink,
  AdminExperienceChangeRequest,
  AdminExperienceChangeSearchExperience,
} from '@/modules/admin/shared/admin-experience-change';

jest.mock('axios');

const axiosMock = jest.mocked(axios);
const AxiosHeaders =
  jest.requireActual<typeof import('axios')>('axios').AxiosHeaders;

function response<T>(data: T): AxiosResponse<T> {
  const headers = new AxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

afterEach(() => jest.clearAllMocks());

it('uses the admin-only lookup, link, queue, and decision APIs', async () => {
  const experience: AdminExperienceChangeSearchExperience = {
    _id: 'experience-1',
    created: '2026-10-13T00:00:00.000Z',
    public: true,
    userFrom: { _id: 'member-1' },
    userTo: { _id: 'member-2' },
    recommend: 'yes',
  };
  const request: AdminExperienceChangeRequest = {
    _id: 'request-1',
    requester: { _id: 'member-1' },
    experience: { ...experience, userFrom: 'member-1', userTo: 'member-2' },
    status: 'pending',
    kind: 'remove',
  };
  const link: AdminExperienceChangeLink = {
    path: '/change?secret=one',
    expiresAt: '2026-10-20T00:00:00.000Z',
  };
  const decision: AdminExperienceChangeDecisionResult = {
    _id: 'request-1',
    status: 'approved',
  };
  axiosMock.get.mockResolvedValueOnce(response([experience]));
  axiosMock.post.mockResolvedValueOnce(response(link));
  axiosMock.get.mockResolvedValueOnce(response([request]));
  axiosMock.post.mockResolvedValueOnce(response(decision));

  await expect(api.findExperiences('member-one')).resolves.toEqual([
    experience,
  ]);
  await expect(api.issueLink('experience-1', 'member-1')).resolves.toBe(link);
  await expect(api.listRequests()).resolves.toEqual([request]);
  await expect(api.decide('request-1', 'approve')).resolves.toBe(decision);

  expect(axiosMock.get).toHaveBeenNthCalledWith(1, '/api/admin/experiences', {
    params: { username: 'member-one' },
  });
  expect(axiosMock.post).toHaveBeenNthCalledWith(
    1,
    '/api/admin/experiences/experience-1/change-links',
    { memberId: 'member-1' },
  );
  expect(axiosMock.get).toHaveBeenNthCalledWith(
    2,
    '/api/admin/experience-change-requests',
  );
  expect(axiosMock.post).toHaveBeenNthCalledWith(
    2,
    '/api/admin/experience-change-requests/request-1/decision',
    { decision: 'approve' },
  );
});
