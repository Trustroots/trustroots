import axios from '../../../core/client/api/http-client.js';

export interface SigninCredentials {
  username: string;
  password: string;
}

export interface SignupCredentials extends SigninCredentials {
  email: string;
  [key: string]: unknown;
}

export interface PasswordDetails {
  newPassword: string;
  verifyPassword: string;
}

export interface AuthenticatedUser {
  _id: string;
  username: string;
  email?: string;
}

export async function signin(
  credentials: SigninCredentials,
): Promise<AuthenticatedUser> {
  const { data } = await axios.post('/api/auth/signin', credentials);
  return data;
}

export async function signup(
  credentials: SignupCredentials,
): Promise<AuthenticatedUser> {
  const { data } = await axios.post('/api/auth/signup', credentials);
  return data;
}

export interface SignupValidationResponse {
  valid?: boolean;
  message?: string;
  username?: string;
  required?: boolean;
  minlength?: boolean;
  maxlength?: boolean;
  pattern?: boolean;
}

export async function validateSignup(
  payload: Partial<SignupCredentials>,
): Promise<SignupValidationResponse> {
  const { data } = await axios.post('/api/auth/signup/validate', payload);
  return data;
}

export interface ConfirmEmailResponse {
  user: AuthenticatedUser;
  profileMadePublic?: boolean;
}

export async function confirmEmail(
  token: string,
): Promise<ConfirmEmailResponse> {
  const { data } = await axios.post(`/api/auth/confirm-email/${token}`);
  return data;
}

export async function forgotPassword(credentials: {
  username: string;
}): Promise<{ message: string }> {
  const { data } = await axios.post('/api/auth/forgot', credentials);
  return data;
}

export async function resetPassword(
  token: string,
  passwordDetails: PasswordDetails,
): Promise<AuthenticatedUser> {
  const { data } = await axios.post(
    `/api/auth/reset/${token}`,
    passwordDetails,
  );
  return data;
}

export async function removeProfile(token: string): Promise<unknown> {
  const { data } = await axios.delete(`/api/users/remove/${token}`, {
    data: { token },
  });
  return data;
}
