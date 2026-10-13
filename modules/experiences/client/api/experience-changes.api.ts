import axios from 'axios';

import type {
  ExperienceChangeAccess,
  ExperienceChangeRequestSummary,
  ExperienceChangeSubmissionResult,
  ExperienceChangeSubmission,
} from '../../shared/experience-change';

const base = (id: string): string => `/api/experiences/${id}`;

export async function readAccess(
  id: string,
  secret: string,
): Promise<ExperienceChangeAccess> {
  const { data } = await axios.get<ExperienceChangeAccess>(
    `${base(id)}/change-access`,
    { headers: { 'X-Experience-Change-Secret': secret } },
  );
  return data;
}

export async function readMine(
  id: string,
): Promise<ExperienceChangeRequestSummary | null> {
  const { data } = await axios.get<ExperienceChangeRequestSummary | null>(
    `${base(id)}/change-requests/mine`,
  );
  return data;
}

export async function submit(
  id: string,
  secret: string,
  request: ExperienceChangeSubmission,
): Promise<ExperienceChangeSubmissionResult> {
  const { data } = await axios.post<ExperienceChangeSubmissionResult>(
    `${base(id)}/change-requests`,
    request,
    { headers: { 'X-Experience-Change-Secret': secret } },
  );
  return data;
}
