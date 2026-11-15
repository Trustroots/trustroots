import axios from '../../../core/client/api/http-client.js';
import type { StaffBlocker } from '../../shared/staff-blockers';

export async function getStaffBlockers(): Promise<StaffBlocker[]> {
  const { data } = await axios.get<StaffBlocker[]>('/api/admin/staff-blockers');
  return data;
}
