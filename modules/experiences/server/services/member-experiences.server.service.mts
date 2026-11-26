import mongoose, { type Types } from 'mongoose';
import type { ExperienceRecord } from '../models/experiences.server.model.mts';

export async function readWrittenExperiences(userId: Types.ObjectId | string) {
  const Experience = mongoose.model<ExperienceRecord>('Experience');
  return Experience.find({ userFrom: userId })
    .sort({ created: 1 })
    .populate('userTo', 'username displayName')
    .lean();
}
