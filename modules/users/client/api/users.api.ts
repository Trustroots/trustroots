import axios from '../../../core/client/api/http-client.js';
import type { UserProfile } from '../types';

export type UserUpdate = Partial<UserProfile> & Record<string, unknown>;

export interface PasswordChangeResult {
  user: UserProfile;
}

export interface ProfileRemovalResult {
  message?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  verifyPassword: string;
}

export async function update(data: UserUpdate): Promise<UserProfile> {
  const { data: user } = await axios.put('/api/users', data);
  return user;
}

export async function fetch(username: string): Promise<UserProfile> {
  const { data: user } = await axios.get(`/api/users/${username}`);
  return user;
}

export async function fetchMini(
  userId: string,
): Promise<Pick<UserProfile, '_id' | 'username' | 'displayName'>> {
  const { data: user } = await axios.get(`/api/users/mini/${userId}`);
  return user;
}

export async function uploadAvatar(file: File): Promise<void> {
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
}: ChangePasswordInput): Promise<PasswordChangeResult> {
  const { data } = await axios.post('/api/users/password', {
    currentPassword,
    newPassword,
    verifyPassword,
  });
  return data;
}

export async function resendEmailConfirmation(): Promise<void> {
  await axios.post('/api/auth/resend-confirmation');
}

export async function removeProfile(): Promise<ProfileRemovalResult> {
  const { data } = await axios.delete('/api/users');
  return data;
}

export async function removeSocialAccount(
  provider: string,
): Promise<UserProfile> {
  const { data } = await axios.delete(`/api/users/accounts/${provider}`);
  return data;
}
