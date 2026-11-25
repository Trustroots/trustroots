import axios from '@trustroots/core/http-client';
import type { StaffBlocker } from '../../shared/staff-blockers';

export async function getStaffBlockers(): Promise<StaffBlocker[]> {
  const { data } = await axios.get<StaffBlocker[]>('/api/admin/staff-blockers');
  return data;
}
