export const messageEmailFrequencies = [
  'immediate',
  'daily',
  'weekly',
  'off',
] as const;
export type MessageEmailFrequency = (typeof messageEmailFrequencies)[number];
