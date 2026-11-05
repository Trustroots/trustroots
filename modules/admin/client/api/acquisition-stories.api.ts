import axios from '../../../core/client/api/http-client.js';

export async function getAcquisitionStories() {
  const { data } = await axios.post('/api/admin/acquisition-stories');
  return data;
}

export async function resendAcquisitionStoryConfirmation(
  userId: string,
): Promise<{ message: string }> {
  const { data } = await axios.post<{ message: string }>(
    `/api/admin/acquisition-stories/${userId}/resend-confirmation`,
  );
  return data;
}
