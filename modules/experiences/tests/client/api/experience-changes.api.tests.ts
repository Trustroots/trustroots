import axios, { type AxiosResponse } from 'axios';
import * as api from '@/modules/experiences/client/api/experience-changes.api';
import type {
  ExperienceChangeAccess,
  ExperienceChangeRequestSummary,
  ExperienceChangeSubmission,
} from '@/modules/experiences/shared/experience-change';

jest.mock('axios');

const axiosMock = jest.mocked(axios);
const AxiosHeaders =
  jest.requireActual<typeof import('axios')>('axios').AxiosHeaders;

function response<T>(data: T): AxiosResponse<T> {
  const headers = new AxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

afterEach(() => jest.clearAllMocks());

it('keeps the support secret in a header rather than an API URL', async () => {
  const access: ExperienceChangeAccess = {
    _id: 'experience-1',
    public: true,
    canEdit: true,
  };
  const request: ExperienceChangeRequestSummary = {
    _id: 'request-1',
    kind: 'remove',
    status: 'pending',
    createdAt: '2026-10-13T00:00:00.000Z',
  };
  const submission: ExperienceChangeSubmission = { kind: 'remove' };
  axiosMock.get.mockResolvedValueOnce(response(access));
  axiosMock.get.mockResolvedValueOnce(response(request));
  axiosMock.post.mockResolvedValueOnce(response(request));

  await expect(api.readAccess('experience-1', 'secret-1')).resolves.toBe(
    access,
  );
  await expect(api.readMine('experience-1')).resolves.toBe(request);
  await expect(
    api.submit('experience-1', 'secret-1', submission),
  ).resolves.toBe(request);

  expect(axiosMock.get).toHaveBeenNthCalledWith(
    1,
    '/api/experiences/experience-1/change-access',
    { headers: { 'X-Experience-Change-Secret': 'secret-1' } },
  );
  expect(axiosMock.get).toHaveBeenNthCalledWith(
    2,
    '/api/experiences/experience-1/change-requests/mine',
  );
  expect(axiosMock.post).toHaveBeenCalledWith(
    '/api/experiences/experience-1/change-requests',
    submission,
    { headers: { 'X-Experience-Change-Secret': 'secret-1' } },
  );
});
