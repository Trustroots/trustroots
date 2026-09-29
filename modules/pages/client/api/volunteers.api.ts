import axios from '../../../core/client/api/http-client.js';

export interface Volunteer {
  _id: string;
  firstName?: string;
  username: string;
}

export interface VolunteersResponse {
  alumni: Volunteer[];
  volunteers: Volunteer[];
}

export async function getVolunteers(): Promise<VolunteersResponse> {
  const { data } = await axios.get<VolunteersResponse>('/api/volunteers');
  return data;
}
