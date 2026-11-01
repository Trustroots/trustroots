import axios from '../../../core/client/api/http-client';
import type {
  SparkpostOverview,
  SparkpostEvents,
  SparkpostPreview,
  RecoveryDay,
  RecoveryResult,
} from '../../shared/sparkpost';
export async function getSparkpostOverview(days: string) {
  return (
    await axios.get<SparkpostOverview>('/api/admin/sparkpost/overview', {
      params: { days },
    })
  ).data;
}
export async function getSparkpostEvents(date: string, cursor = '') {
  return (
    await axios.get<SparkpostEvents>('/api/admin/sparkpost/events', {
      params: { date, ...(cursor ? { cursor } : {}) },
      timeout: 60000,
    })
  ).data;
}
export async function getSparkpostPreview(from: string, to: string) {
  return (
    await axios.get<SparkpostPreview>('/api/admin/sparkpost/preview', {
      params: { from, to },
    })
  ).data;
}
export async function getRecoveryDay(date: string, page = 1) {
  return (
    await axios.get<RecoveryDay>('/api/admin/sparkpost/recovery', {
      params: { date, page },
    })
  ).data;
}
export async function sendRecovery(date: string, keys: string[]) {
  return (
    await axios.post<{ results: RecoveryResult[] }>(
      '/api/admin/sparkpost/recovery',
      { date, keys },
    )
  ).data;
}
export async function getRecoveryAccounts(
  from: string,
  to: string,
  page: number,
) {
  return (
    await axios.get<RecoveryDay>('/api/admin/sparkpost/accounts', {
      params: { from, to, page },
    })
  ).data;
}
