import axios from 'axios';

export async function signin(credentials) {
  const { data } = await axios.post('/api/auth/signin', credentials);
  return data;
}

export async function signup(credentials) {
  const { data } = await axios.post('/api/auth/signup', credentials);
  return data;
}

export async function validateSignup(payload) {
  const { data } = await axios.post('/api/auth/signup/validate', payload);
  return data;
}

export async function confirmEmail(token) {
  const { data } = await axios.post(`/api/auth/confirm-email/${token}`);
  return data;
}

export async function forgotPassword(credentials) {
  const { data } = await axios.post('/api/auth/forgot', credentials);
  return data;
}

export async function resetPassword(token, passwordDetails) {
  const { data } = await axios.post(
    `/api/auth/reset/${token}`,
    passwordDetails,
  );
  return data;
}

export async function removeProfile(token) {
  const { data } = await axios.delete(`/api/users/remove/${token}`, {
    data: { token },
  });
  return data;
}
