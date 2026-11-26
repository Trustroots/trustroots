import React from 'react';
import type { ProfileExperiences } from '@/modules/users/client/profile-experiences';
import { getCount, readMine, readReplyRecipient } from './api/experiences.api';
import CreateExperience from './components/CreateExperience.component';
import ListExperiences from './components/ListExperiences.component';
import PendingAuthoredExperiences from './components/PendingAuthoredExperiences';
import Experience from './components/read-experiences/Experience';
import type { ExperienceMine } from '../shared/experience';

export const profileExperiences = {
  readReplyRecipient,
  getCount,
  async readAuthoredExperienceId(memberId, authorId) {
    const experience = await readMine({ userWith: memberId });
    if (!experience) return null;
    const author = experience.userFrom;
    const experienceAuthorId = typeof author === 'string' ? author : author._id;
    return experienceAuthorId === authorId ? experience._id : null;
  },
  Create: CreateExperience,
  List: ListExperiences,
  PendingAuthored: PendingAuthoredExperiences,
  Authored: ({ experience, author, recipient }) => (
    <Experience
      experience={{
        ...experience,
        userFrom: { _id: author._id, username: author.username },
        userTo: recipient,
        response: null,
      }}
      onReceiverProfile={false}
    />
  ),
} satisfies ProfileExperiences<ExperienceMine>;
