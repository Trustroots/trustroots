export const sendSignupReminderJob = 'deliver signup reminder';

export interface SignupReminder {
  userId: string;
  emailToken: string;
  previousToken?: string | null;
  previousIssuedAt?: Date | null;
  previousExpires?: Date | null;
}
