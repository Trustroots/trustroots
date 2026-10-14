import axios from 'axios';

import type {
  AdminExperienceChangeDecision,
  AdminExperienceChangeDecisionResult,
  AdminExperienceChangeLink,
  AdminExperienceChangeRequest,
  AdminExperienceChangeSearchExperience,
} from '../../shared/admin-experience-change';

export async function findExperiences(
  username: string,
): Promise<AdminExperienceChangeSearchExperience[]> {
  const { data } = await axios.get<AdminExperienceChangeSearchExperience[]>(
    '/api/admin/experiences',
    { params: { username } },
  );
  return data;
}

export async function issueLink(
  id: string,
  memberId: string,
): Promise<AdminExperienceChangeLink> {
  const { data } = await axios.post<AdminExperienceChangeLink>(
    `/api/admin/experiences/${id}/change-links`,
    { memberId },
  );
  return data;
}

export async function listRequests(): Promise<AdminExperienceChangeRequest[]> {
  const { data } = await axios.get<AdminExperienceChangeRequest[]>(
    '/api/admin/experience-change-requests',
  );
  return data;
}

export async function decide(
  id: string,
  decision: AdminExperienceChangeDecision,
): Promise<AdminExperienceChangeDecisionResult> {
  const { data } = await axios.post<AdminExperienceChangeDecisionResult>(
    `/api/admin/experience-change-requests/${id}/decision`,
    { decision },
  );
  return data;
}
