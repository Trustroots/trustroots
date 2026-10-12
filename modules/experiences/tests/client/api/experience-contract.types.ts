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
} from '../../../shared/experience';

/** Compile-only checks: these must keep failing if a contract is weakened. */
async function checkClientContracts() {
  const created: ExperienceMine = await create({
    userTo: 'member-id',
    recommend: 'yes',
  });
  const experiences: Experience[] = await read({ userTo: 'member-id' });
  const mine: ExperienceMine | null = await readMine({ userWith: 'member-id' });
  const count: ExperienceCount = await getCount('member-id');

  // @ts-expect-error Invalid recommendations must not cross the client API boundary.
  await create({ recommend: 'sometimes' });
  // @ts-expect-error Private feedback can be absent.
  const feedback: string = experiences[0].feedbackPublic;
  // @ts-expect-error Reciprocal responses do not contain member identities.
  const author = experiences[0].response?.userFrom;
  // @ts-expect-error The count is a number, never a formatted string.
  const formatted: string = count.count;
  return { created, mine, feedback, author, formatted };
}

// Referencing the function keeps this file a module without issuing HTTP requests.
void checkClientContracts;
