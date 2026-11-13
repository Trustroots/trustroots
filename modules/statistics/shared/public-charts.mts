export interface PublicCharts {
  weeks: Array<{
    weekStarting: string;
    signups: number;
    conversationsStarted: number;
    firstReplies: number;
  }>;
  memberActivity: {
    past7Days: number;
    past14Days: number;
    past30Days: number;
    past6Months: number;
    past12Months: number;
  };
}
