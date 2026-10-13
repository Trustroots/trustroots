import {
  create,
  read,
  readMine,
  getCount,
} from '../../../client/api/experiences.api';
import type {
  Experience,
  ExperienceMine,
  ExperienceCount,
  ExperienceCountRequest,
} from '../../../shared/experience';
import {
  isValidExperienceCountUserTo,
  type ExperienceCountAggregateGroup,
} from '../../../server/controllers/experience-count.server.contracts.mts';

declare const rawUserTo: unknown;

/** Compile-only checks: these must keep failing if a contract is weakened. */
async function checkClientContracts() {
  const created: ExperienceMine = await create({
    userTo: 'member-id',
    recommend: 'yes',
  });
  const experiences: Experience[] = await read({ userTo: 'member-id' });
  const mine: ExperienceMine | null = await readMine({ userWith: 'member-id' });
  const count: ExperienceCount = await getCount('member-id');

  // @ts-expect-error Raw HTTP query values must be validated before becoming a request DTO.
  const unvalidatedRequest: ExperienceCountRequest = { userTo: rawUserTo };
  if (isValidExperienceCountUserTo(rawUserTo)) {
    const request: ExperienceCountRequest = {
      userTo: rawUserTo,
    };
    void request;
  }

  const aggregateGroup: ExperienceCountAggregateGroup = {
    _id: true,
    count: 3,
  };
  const invalidAggregateKey: ExperienceCountAggregateGroup = {
    // @ts-expect-error MongoDB groups by the boolean public field.
    _id: 'public',
    count: 3,
  };
  const invalidAggregateCount: ExperienceCountAggregateGroup = {
    _id: true,
    // @ts-expect-error MongoDB returns a numeric count.
    count: '3',
  };

  // @ts-expect-error Invalid recommendations must not cross the client API boundary.
  await create({ recommend: 'sometimes' });
  // @ts-expect-error Private feedback can be absent.
  const feedback: string = experiences[0].feedbackPublic;
  // @ts-expect-error Reciprocal responses do not contain member identities.
  const author = experiences[0].response?.userFrom;
  // @ts-expect-error The count is a number, never a formatted string.
  const formatted: string = count.count;
  // @ts-expect-error The API count must remain numeric.
  const invalidResponse: ExperienceCount = { count: '3' };
  return {
    created,
    mine,
    feedback,
    author,
    formatted,
    unvalidatedRequest,
    aggregateGroup,
    invalidAggregateKey,
    invalidAggregateCount,
    invalidResponse,
  };
}

// Referencing the function keeps this file a module without issuing HTTP requests.
void checkClientContracts;
