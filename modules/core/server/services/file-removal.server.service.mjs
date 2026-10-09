import { rm } from 'node:fs/promises';
import path from 'node:path';

/** Preserve the deletion utility's boundary: only descendants of the checkout. */
export async function removeLocalPath(target) {
  const resolved = path.resolve(target);
  const relative = path.relative(process.cwd(), resolved);
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith('..' + path.sep) ||
    path.isAbsolute(relative)
  ) {
    throw new Error('Cannot delete the working directory or paths outside it.');
  }
  await rm(resolved, { recursive: true, force: true });
}

const service = { removeLocalPath };
export default service;
export { service as 'module.exports' };
