import mongoose from 'mongoose';
import type { ExperienceCount } from '../../shared/experience.js';

export interface ExperienceCountRequestHandlerRequest {
  query: { userTo?: unknown };
  user: { _id: { equals(value: string): boolean } };
}

export interface ExperienceCountResponseWriter {
  status(code: number): ExperienceCountResponseWriter;
  send(body: unknown): ExperienceCountResponseWriter;
  json(body: ExperienceCount): ExperienceCountResponseWriter;
}

export interface ExperienceCountAggregateGroup {
  _id: boolean;
  count: number;
}

export type ExperienceCountNext = (error?: unknown) => unknown;
export type ExperienceCountProcessResponses = (
  response: ExperienceCountResponseWriter,
  next: ExperienceCountNext,
  error: unknown,
) => unknown;

export function isValidExperienceCountUserTo(value: unknown): value is string {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}
