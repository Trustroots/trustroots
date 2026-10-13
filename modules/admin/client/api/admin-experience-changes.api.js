import axios from 'axios';

export async function findExperiences(username) {
  const { data } = await axios.get('/api/admin/experiences', {
    params: { username },
  });
  return data;
}

export async function issueLink(id, memberId) {
  const { data } = await axios.post(
    `/api/admin/experiences/${id}/change-links`,
    { memberId },
  );
  return data;
}

export async function listRequests() {
  const { data } = await axios.get('/api/admin/experience-change-requests');
  return data;
}

export async function decide(id, decision) {
  const { data } = await axios.post(
    `/api/admin/experience-change-requests/${id}/decision`,
    { decision },
  );
  return data;
}
