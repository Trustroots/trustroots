import axios from 'axios';

const httpClient = axios.create({
  timeout: 120000,
});

const stateChangingMethods = new Set(['post', 'put', 'patch', 'delete']);

httpClient.interceptors.request.use(config => {
  if (stateChangingMethods.has(config.method)) {
    config.headers.set('X-Trustroots-Request', '1', true);
  }

  return config;
});

export function getErrorResponse(error) {
  return error?.response;
}

export default httpClient;
