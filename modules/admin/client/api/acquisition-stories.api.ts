import axios from '@trustroots/core/http-client';

export async function getAcquisitionStories() {
  const { data } = await axios.post('/api/admin/acquisition-stories');
  return data;
}

export async function flagAcquisitionStoryMember(userId: string) {
  await axios.post(
    `/api/admin/acquisition-stories/${encodeURIComponent(userId)}/flag`,
  );
}

export async function resendAcquisitionStoryConfirmation(
  userId: string,
): Promise<{ message: string }> {
  const { data } = await axios.post<{ message: string }>(
    `/api/admin/acquisition-stories/${userId}/resend-confirmation`,
  );
  return data;
}
