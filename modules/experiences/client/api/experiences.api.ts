import axios from 'axios';
import { readApiError } from '@/modules/users/client/utils/api-error';
import type {
  Experience,
  ExperienceMine,
  ExperienceRecommendation,
} from '../experiences.prop-types';

export interface ExperienceDraft {
  interactions?: { met?: boolean; host?: boolean; guest?: boolean };
  recommend?: ExperienceRecommendation | null;
  feedbackPublic?: string;
  userTo?: string;
  [key: string]: unknown;
}

interface UserTarget {
  userTo: string;
}

interface UserWith {
  userWith: string;
}

/**
 * API request: create an experience
 * @param {object} experience - experience to save
 * @returns {object} - saved experience object, which includes the "response" to it if exists
 */
export async function create(experience: ExperienceDraft): Promise<Experience> {
  const { data: responseExperience } = await axios.post(
    '/api/experiences',
    experience,
  );
  return responseExperience;
}

/**
 * API request: read experiences shared with `userTo`;
 * sorted by `created` field starting from the most recent date
 *
 * @param {string} userTo - id of the user with whom the experiences were shared
 * @returns {array} - array of experience objects, which include the "responses" to them where exist
 */
export async function read({ userTo }: UserTarget): Promise<Experience[]> {
  const { data: experiences } = await axios.get('/api/experiences', {
    params: { userTo },
  });
  return experiences;
}

/**
 * API request: read the experience shared
 * - by the logged-in user with `userTo`
 * and
 * - by the `userTo` with the logged-in user
 *
 * @param {string} userWith - id of the user with whom the experience was shared
 * @returns {object} - experience object, where both experiences are returned
 * in an experience object with response. The `response` field is `null` if only
 * one party shared the experience, otherwise the "primary" experience is the one
 * shared by the logged-in user.
 */
export async function readMine({
  userWith,
}: UserWith): Promise<ExperienceMine | null> {
  const params = { userWith };
  try {
    const { data: experience } = await axios.get('/api/my-experience', {
      params,
    });
    return experience;
  } catch (err: unknown) {
    if (readApiError(err).status === 404) {
      return null;
    } else {
      throw err;
    }
  }
}

/**
 * API request: get count of experiences
 *
 * @param {string} userTo - id of the user with whom the experiences were shared
 * @returns {object} - Number of experiences as `{count: Int, hasPending: Bool}`
 */
export async function getCount(
  userTo: string,
): Promise<{ count: number; hasPending?: boolean }> {
  try {
    const { data } = await axios.get('/api/experiences/count', {
      params: { userTo },
    });
    return data;
  } catch {
    return { count: 0 };
  }
}

/**
 * API request: get one contact for whom the logged-in member can share an
 * experience.
 *
 * @returns {object|null} a minimal public member profile or null
 */
export async function getSuggestion(): Promise<Record<string, unknown> | null> {
  const { data } = await axios.get('/api/experiences/suggestion');
  return data;
}
