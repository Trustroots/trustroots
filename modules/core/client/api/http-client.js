import axios from 'axios';

const httpClient = axios.create({
  timeout: 15000,
});

export function getErrorResponse(error) {
  return error?.response;
}

export default httpClient;
