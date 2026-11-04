import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    /**
     * Statuses this request answers by design, such as a 404 for "no offer"
     * or "not a contact". They are handled by the caller and are not
     * reported as failed requests.
     */
    expectedStatuses?: readonly number[];
  }
}

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

/** What an analytics event may know about a failed request: no URL, ids or body. */
export type RequestFailure = {
  status: number;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'other';
  area: string;
};

type RequestFailureListener = (failure: RequestFailure) => void;

const requestFailureListeners = new Set<RequestFailureListener>();

const knownMethods = new Set(['get', 'post', 'put', 'patch', 'delete']);

/**
 * Reduce a failed request to coarse values: the HTTP status (0 without a
 * response), the method, and the first path segment after `/api/` (for
 * example `users` for `/api/users/someone`), or `external` for other URLs.
 */
export function describeRequestFailure(error: unknown): RequestFailure {
  const config =
    typeof error === 'object' && error !== null && 'config' in error
      ? (error as { config?: { method?: string; url?: string } }).config
      : undefined;
  const method = config?.method?.toLowerCase() ?? '';
  const area = /^\/api\/([a-z][a-z-]{0,31})(?:[/?]|$)/.exec(config?.url ?? '');

  return {
    status: getErrorResponse(error)?.status ?? 0,
    method: knownMethods.has(method)
      ? (method as RequestFailure['method'])
      : 'other',
    area: area?.[1] ?? 'external',
  };
}

/**
 * Subscribe to unexpected failed requests. Cancellations, requests that never
 * got a response (offline, timeouts) and statuses the request lists in
 * `expectedStatuses` are skipped. Returns an unsubscribe function.
 */
export function onRequestFailure(listener: RequestFailureListener): () => void {
  requestFailureListeners.add(listener);
  return () => {
    requestFailureListeners.delete(listener);
  };
}

httpClient.interceptors.response.use(undefined, (error: unknown) => {
  // Cancelled and offline requests have no response, so no status.
  const status = getErrorResponse(error)?.status;
  if (
    status &&
    !(
      error as { config?: AxiosRequestConfig }
    ).config?.expectedStatuses?.includes(status)
  ) {
    const failure = describeRequestFailure(error);
    requestFailureListeners.forEach(listener => listener(failure));
  }
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
