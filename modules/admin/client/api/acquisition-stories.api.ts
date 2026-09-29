import axios from '../../../core/client/api/http-client.js';

export async function getAcquisitionStories() {
  const { data } = await axios.post('/api/admin/acquisition-stories');
  return data;
}

export async function getAcquisitionStoriesAnalysis() {
  const { data } = await axios.post('/api/admin/acquisition-stories/analysis');
  return data;
}
