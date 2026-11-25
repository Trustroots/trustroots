import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import axios, { getErrorResponse } from '../../../core/client/api/http-client';

export const ADMIN_ELEVATION_REQUIRED = 'ADMIN_ELEVATION_REQUIRED';

type ElevationListener = {
  resolve: (password: string) => void;
  reject: (error: Error) => void;
};

let pendingElevation: ElevationListener | null = null;
let interceptorRegistered = false;
let elevateInFlight: Promise<void> | null = null;

export function requestAdminPassword(): Promise<string> {
  return new Promise((resolve, reject) => {
    pendingElevation = { resolve, reject };
    window.dispatchEvent(new CustomEvent('trustroots:admin-elevation'));
  });
}

export function submitAdminPassword(password: string) {
  pendingElevation?.resolve(password);
  pendingElevation = null;
}

export function cancelAdminPassword() {
  pendingElevation?.reject(new Error('Admin confirmation cancelled.'));
  pendingElevation = null;
}

export function isAdminElevationPending() {
  return pendingElevation !== null;
}

async function elevateWithPassword(password: string) {
  await axios.post('/api/admin/elevate', { password });
}

async function ensureElevated() {
  if (!elevateInFlight) {
    elevateInFlight = (async () => {
      const password = await requestAdminPassword();
      await elevateWithPassword(password);
    })().finally(() => {
      elevateInFlight = null;
    });
  }
  await elevateInFlight;
}

function isAdminApiRequest(config?: InternalAxiosRequestConfig) {
  const url = config?.url || '';
  return url.includes('/api/admin/') && !url.includes('/api/admin/elevate');
}

export function registerAdminElevationInterceptor() {
  if (interceptorRegistered) {
    return;
  }
  interceptorRegistered = true;

  axios.interceptors.response.use(
    response => response,
    async (error: AxiosError) => {
      const response = getErrorResponse(error);
      const config = error.config as
        | (InternalAxiosRequestConfig & { __adminElevationRetried?: boolean })
        | undefined;
      const code = (response?.data as { code?: string } | undefined)?.code;
      if (
        response?.status === 403 &&
        code === ADMIN_ELEVATION_REQUIRED &&
        config &&
        !config.__adminElevationRetried &&
        isAdminApiRequest(config)
      ) {
        config.__adminElevationRetried = true;
        await ensureElevated();
        return axios(config);
      }
      return Promise.reject(error);
    },
  );
}
