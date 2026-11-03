// The server Vitest config, as run by Stryker. Each Stryker worker runs its
// own Vitest, so give each one its own database: the suite drops its database
// on start, and two runs sharing one would wipe each other's data.
import config from './vitest.server.config.mts';

const worker = Number(process.env.STRYKER_MUTATOR_WORKER ?? 0);
process.env.NODE_ENV = 'test';
process.env.TRUSTROOTS_SKIP_LOCAL_CONFIG = 'true';
process.env.TRUSTROOTS_SERVER_TEST_DATABASE = `trustroots-test-worker-5772796b6572-${(worker % 8) + 1}`;

export default config;
