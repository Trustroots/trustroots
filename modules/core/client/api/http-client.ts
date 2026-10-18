import axios, { type AxiosResponse } from 'axios';
import { viewNavigation } from '../services/member-view.js';

const httpClient = axios.create({
  timeout: 120000,
});

const stateChangingMethods = new Set(['post', 'put', 'patch', 'delete']);

httpClient.interceptors.request.use(config => {
  if (window.viewContext) {
    config.headers.set(
      'X-Trustroots-View',
      window.viewContext.generation,
      true,
    );
    if (
      window.viewContext.username &&
      config.method &&
      stateChangingMethods.has(config.method) &&
      !['/api/auth/masquerade/stop', '/api/auth/signout'].includes(
        config.url || '',
      )
    ) {
      return Promise.reject(
        new Error(
          'This member view is read-only. Return to your account to make changes.',
        ),
      );
    }
  }
  if (config.method && stateChangingMethods.has(config.method)) {
    config.headers.set('X-Trustroots-Request', '1', true);
  }

  return config;
});

httpClient.interceptors.response.use(undefined, error => {
  if (
    ['VIEW_CONTEXT_CHANGED', 'VIEW_EXPIRED'].includes(
      error.response?.data?.code,
    )
  )
    viewNavigation.reload();
  return Promise.reject(error);
});

export function getErrorResponse(error: unknown): AxiosResponse | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return undefined;
  }

  return (error as { response?: AxiosResponse }).response;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  const response = getErrorResponse(error);
  return response?.data?.message || fallback;
}

export default httpClient;
