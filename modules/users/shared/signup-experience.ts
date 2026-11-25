export const signupExperienceLevels = ['none', 'once', 'few', 'many'] as const;

export type SignupExperience = (typeof signupExperienceLevels)[number];
