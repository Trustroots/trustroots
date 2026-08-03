import axios from 'axios';

export async function update(data) {
  const { data: user } = await axios.put('/api/users', data);
  return user;
}

export async function fetch(username) {
  const { data: user } = await axios.get(`/api/users/${username}`);
  return user;
}

export async function fetchMini(userId) {
  const { data: user } = await axios.get(`/api/users/mini/${userId}`);
  return user;
}

export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append('avatar', file);
  await axios.post('/api/users-avatar', formData, {
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
}

export async function changePassword({
  currentPassword,
  newPassword,
  verifyPassword,
}) {
  const { data } = await axios.post('/api/users/password', {
    currentPassword,
    newPassword,
    verifyPassword,
  });
  return data;
}

export async function resendEmailConfirmation() {
  await axios.post('/api/auth/resend-confirmation');
}

export async function removeProfile() {
  const { data } = await axios.delete('/api/users');
  return data;
}

export async function removeSocialAccount(provider) {
  const { data } = await axios.delete(`/api/users/accounts/${provider}`);
  return data;
}
