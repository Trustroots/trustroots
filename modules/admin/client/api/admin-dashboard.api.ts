import axios from 'axios';

export interface AdminUserSummary {
  _id?: string;
  [key: string]: unknown;
}

interface DashboardThreadVote {
  _id: string;
  created?: string;
  thread: string;
  userFrom?: AdminUserSummary;
  userTo?: AdminUserSummary;
}

interface DashboardMessenger {
  messageCount: number;
  user?: AdminUserSummary;
}

interface DashboardExperience {
  _id: string;
  created?: string;
  userFrom?: AdminUserSummary;
  userTo?: AdminUserSummary;
}

export interface AdminDashboard {
  negativeExperiences: DashboardExperience[];
  threadVotes: DashboardThreadVote[];
  topMessengers: DashboardMessenger[];
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const { data } = await axios.get('/api/admin/dashboard');
  return data as AdminDashboard;
}
