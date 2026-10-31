import axios from '../../../core/client/api/http-client';
import type {
  SparkpostOverview,
  SparkpostEvents,
  SparkpostPreview,
} from '../../shared/sparkpost';

export async function getSparkpostOverview(days: string) {
  return (
    await axios.get<SparkpostOverview>('/api/admin/sparkpost/overview', {
      params: { days },
    })
  ).data;
}
export async function getSparkpostEvents(date: string) {
  return (
    await axios.get<SparkpostEvents>('/api/admin/sparkpost/events', {
      params: { date },
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
