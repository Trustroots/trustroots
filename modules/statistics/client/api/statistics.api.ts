import axios from '../../../core/client/api/http-client.js';

export interface StatisticsResponse {
  connections?: Array<{ network: string; count: number; percentage: number }>;
  experiences?: {
    notRecommended?: number;
    recommended?: number;
    recent?: { notRecommended?: number; recommended?: number };
    realLifeConnections?: { recent?: number; total?: number };
  };
  hosting?: {
    maybe?: number;
    maybePercentage?: number;
    percentage?: number;
    total?: number;
    yes?: number;
    yesPercentage?: number;
  };
  messageInteractions?: {
    negative?: number;
    positive?: number;
    recent?: { negative?: number; positive?: number; total?: number };
    total?: number;
  };
  newsletter?: { count?: number; percentage?: number };
  total?: number;
}

export async function get() {
  return axios.get<StatisticsResponse>('/api/statistics');
}
