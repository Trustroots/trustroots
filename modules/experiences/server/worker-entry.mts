export default {
  publishExperiences: () => import('./jobs/experiences-publish.server.job.mts'),
  experienceReplyReminders: () =>
    import('./jobs/experience-reply-reminder.server.job.mts'),
};
