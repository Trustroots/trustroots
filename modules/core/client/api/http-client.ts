import axios, { type AxiosResponse } from 'axios';

const httpClient = axios.create({
  timeout: 120000,
});

const stateChangingMethods = new Set(['post', 'put', 'patch', 'delete']);

httpClient.interceptors.request.use(config => {
  if (config.method && stateChangingMethods.has(config.method)) {
    config.headers.set('X-Trustroots-Request', '1', true);
  }

  return config;
});

export function getErrorResponse(
  error: unknown,
): AxiosResponse | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return undefined;
  }

  return (error as { response?: AxiosResponse }).response;
}

export default httpClient;
