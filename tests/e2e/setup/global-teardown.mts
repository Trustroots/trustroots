import { mergeRawCoverage } from '../../../scripts/e2e/merge-js-coverage.mts';

export default async function globalTeardown(): Promise<void> {
  await mergeRawCoverage();
}
