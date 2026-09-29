import axios from 'axios';

const httpClient = axios.create({
  timeout: 15000,
});

httpClient.interceptors.request.use(config => {
  if (config.method && config.method.toLowerCase() !== 'get') {
    config.headers.set('X-Trustroots-Request', '1');
  }

  return config;
});

export function getErrorResponse(error) {
  return error?.response;
}

export default httpClient;
