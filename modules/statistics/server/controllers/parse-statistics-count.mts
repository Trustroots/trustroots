export default function parseStatisticsCount(value: unknown): number {
  return parseInt(value as string, 10) || 0;
}
