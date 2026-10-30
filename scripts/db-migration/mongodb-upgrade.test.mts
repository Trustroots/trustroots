import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advanceFcv,
  assertFcvTransition,
  inspectServer,
  MigrationCheckError,
  sanitisedAction,
  uriHasDatabase,
  type MigrationClient,
  type ServerState,
  verifyModels,
} from './mongodb-upgrade.mts';

function healthyReplicaState(
  overrides: Partial<ServerState> = {},
): ServerState {
  return {
    version: '7.0.45',
    series: '7.0',
    fcv: '6.0',
    fcvTransition: false,
    topology: 'replicaSet',
    writablePrimary: true,
    replicaMembers: { total: 3, healthy: 3 },
    ...overrides,
  };
}

function standaloneState(overrides: Partial<ServerState> = {}): ServerState {
  return {
    version: '7.0.45',
    series: '7.0',
    fcv: '6.0',
    fcvTransition: false,
    topology: 'standalone',
    writablePrimary: true,
    ...overrides,
  };
}

function clientWithState(
  initialState: ServerState,
  options: {
    updateFcv?: boolean;
    failSet?: boolean;
    transitionAfterSet?: boolean;
    transitionField?: 'targetVersion' | 'previousVersion';
  } = {},
): { client: MigrationClient; commands: Record<string, unknown>[] } {
  let fcv = initialState.fcv;
  let fcvTransition = initialState.fcvTransition;
  const commands: Record<string, unknown>[] = [];
  const admin = {
    async command(command: Record<string, unknown>) {
      commands.push(command);
      if ('buildInfo' in command)
        return { ok: 1, version: initialState.version };
      if ('getParameter' in command) {
        return {
          ok: 1,
          featureCompatibilityVersion: {
            version: fcv,
            ...(fcvTransition
              ? { [options.transitionField ?? 'targetVersion']: '7.0' }
              : {}),
          },
        };
      }
      if ('hello' in command) {
        return {
          ok: 1,
          ...(initialState.topology === 'replicaSet'
            ? { setName: 'private-hosts-hidden' }
            : initialState.topology === 'sharded'
              ? { msg: 'isdbgrid' }
              : {}),
          isWritablePrimary: initialState.writablePrimary,
        };
      }
      if ('replSetGetStatus' in command) {
        return {
          ok: 1,
          members: Array.from(
            { length: initialState.replicaMembers?.total ?? 0 },
            (_, index) => ({
              host: `private-${index}`,
              health:
                index < (initialState.replicaMembers?.healthy ?? 0) ? 1 : 0,
              state: index === 0 ? 1 : 2,
            }),
          ),
        };
      }
      if ('setFeatureCompatibilityVersion' in command) {
        if (options.failSet) return { ok: 0, errmsg: 'mongodb://secret-host' };
        if (options.updateFcv !== false) {
          fcv = String(command.setFeatureCompatibilityVersion);
          fcvTransition = options.transitionAfterSet === true;
        }
        return { ok: 1 };
      }
      throw new Error('Unexpected test command');
    },
  };
  return {
    commands,
    client: { db: () => ({ admin: () => admin }) },
  };
}

test('inspect reports only allowlisted state and does not write', async () => {
  const { client, commands } = clientWithState(healthyReplicaState());

  const state = await inspectServer(client);

  assert.deepEqual(state, {
    version: '7.0.45',
    series: '7.0',
    fcv: '6.0',
    fcvTransition: false,
    topology: 'replicaSet',
    writablePrimary: true,
    replicaMembers: { total: 3, healthy: 3 },
  });
  assert.equal(JSON.stringify(state).includes('private-'), false);
  assert.equal(
    commands.some(command => 'setFeatureCompatibilityVersion' in command),
    false,
  );
});

test('accepts each supported sequential FCV step', () => {
  assert.doesNotThrow(() =>
    assertFcvTransition(
      '4.4',
      '5.0',
      standaloneState({ series: '5.0', version: '5.0.31', fcv: '4.4' }),
    ),
  );
  assert.doesNotThrow(() =>
    assertFcvTransition(
      '5.0',
      '6.0',
      standaloneState({ series: '6.0', version: '6.0.26', fcv: '5.0' }),
    ),
  );
  assert.doesNotThrow(() =>
    assertFcvTransition('6.0', '7.0', standaloneState()),
  );
});

test('rejects non-sequential transitions before a server command', async () => {
  const { client, commands } = clientWithState(healthyReplicaState());

  await assert.rejects(
    advanceFcv(client, '5.0', '7.0'),
    (error: unknown) =>
      error instanceof MigrationCheckError &&
      error.code === 'NON_SEQUENTIAL_TRANSITION',
  );
  assert.equal(
    commands.some(command => 'setFeatureCompatibilityVersion' in command),
    false,
  );
});

test('rejects binary, FCV, primary and topology mismatches without mutation', async t => {
  const cases: Array<[string, ServerState, string, string, string]> = [
    [
      'binary mismatch',
      standaloneState({ series: '6.0', version: '6.0.26' }),
      '6.0',
      '7.0',
      'TARGET_BINARY_MISMATCH',
    ],
    [
      'FCV mismatch',
      standaloneState({ fcv: '5.0' }),
      '6.0',
      '7.0',
      'SOURCE_FCV_MISMATCH',
    ],
    [
      'FCV transition in progress',
      standaloneState({ fcvTransition: true }),
      '6.0',
      '7.0',
      'FCV_TRANSITION_IN_PROGRESS',
    ],
    [
      'non-writable standalone',
      standaloneState({ writablePrimary: false }),
      '6.0',
      '7.0',
      'NOT_WRITABLE_PRIMARY',
    ],
    [
      'replica set topology',
      healthyReplicaState(),
      '6.0',
      '7.0',
      'UNSUPPORTED_TOPOLOGY',
    ],
    [
      'sharded topology',
      healthyReplicaState({ topology: 'sharded' }),
      '6.0',
      '7.0',
      'UNSUPPORTED_TOPOLOGY',
    ],
    [
      'unhealthy replica set',
      healthyReplicaState({ replicaMembers: { total: 3, healthy: 2 } }),
      '6.0',
      '7.0',
      'REPLICA_SET_UNHEALTHY',
    ],
  ];
  for (const [name, state, source, target, code] of cases) {
    await t.test(name, async () => {
      const { client, commands } = clientWithState(state);
      await assert.rejects(
        advanceFcv(client, source, target),
        (error: unknown) =>
          error instanceof MigrationCheckError && error.code === code,
      );
      assert.equal(
        commands.some(command => 'setFeatureCompatibilityVersion' in command),
        false,
      );
    });
  }
});

test('uses confirm only for MongoDB 7 and verifies FCV read-back', async () => {
  const seven = clientWithState(standaloneState());
  const sevenResult = await advanceFcv(seven.client, '6.0', '7.0');
  const sevenCommand = seven.commands.find(
    command => 'setFeatureCompatibilityVersion' in command,
  );
  assert.deepEqual(sevenCommand, {
    setFeatureCompatibilityVersion: '7.0',
    confirm: true,
  });
  assert.equal(sevenResult.after.fcv, '7.0');

  const six = clientWithState(
    standaloneState({ version: '6.0.26', series: '6.0', fcv: '5.0' }),
  );
  await advanceFcv(six.client, '5.0', '6.0');
  const sixCommand = six.commands.find(
    command => 'setFeatureCompatibilityVersion' in command,
  );
  assert.deepEqual(sixCommand, { setFeatureCompatibilityVersion: '6.0' });
  assert.equal('confirm' in (sixCommand ?? {}), false);
});

test('maps FCV command failures to safe codes without exposing raw error text', async () => {
  const { client } = clientWithState(standaloneState(), { failSet: true });

  await assert.rejects(
    advanceFcv(client, '6.0', '7.0'),
    (error: unknown) =>
      error instanceof MigrationCheckError &&
      error.code === 'FCV_ADVANCE_FAILED' &&
      !error.message.includes('secret-host'),
  );
});

test('requires an FCV read-back to match the requested target', async () => {
  const { client } = clientWithState(standaloneState(), { updateFcv: false });

  await assert.rejects(
    advanceFcv(client, '6.0', '7.0'),
    (error: unknown) =>
      error instanceof MigrationCheckError &&
      error.code === 'FCV_READBACK_MISMATCH',
  );
});

test('rejects transitional FCV metadata before and after advancement', async t => {
  for (const transitionField of ['targetVersion', 'previousVersion'] as const) {
    await t.test(transitionField, async () => {
      const before = clientWithState(standaloneState({ fcvTransition: true }), {
        transitionField,
      });
      await assert.rejects(
        advanceFcv(before.client, '6.0', '7.0'),
        (error: unknown) =>
          error instanceof MigrationCheckError &&
          error.code === 'FCV_TRANSITION_IN_PROGRESS',
      );
      assert.equal(
        before.commands.some(
          command => 'setFeatureCompatibilityVersion' in command,
        ),
        false,
      );

      const after = clientWithState(standaloneState(), {
        transitionAfterSet: true,
        transitionField,
      });
      await assert.rejects(
        advanceFcv(after.client, '6.0', '7.0'),
        (error: unknown) =>
          error instanceof MigrationCheckError &&
          error.code === 'FCV_READBACK_MISMATCH',
      );
    });
  }
});

test('rejects empty model verification and invalid URI/action inputs', async () => {
  await assert.rejects(
    verifyModels([]),
    (error: unknown) =>
      error instanceof MigrationCheckError &&
      error.code === 'NO_APPLICATION_MODELS',
  );
  assert.equal(uriHasDatabase('mongodb://user:secret@host:27017'), false);
  assert.equal(
    uriHasDatabase('mongodb://user:secret@host:27017/trustroots'),
    true,
  );
  assert.equal(sanitisedAction('--private-option=secret'), 'unknown');
});

test('verifies model reads and declared index semantics without writes', async () => {
  const calls: string[] = [];
  const result = await verifyModels([
    {
      collectionName: 'users',
      indexes: [{ key: { email: 1 }, options: { unique: true } }],
      async readIdOnly() {
        calls.push('read');
      },
      async listIndexes() {
        calls.push('listIndexes');
        return [
          { key: { _id: 1 }, name: '_id_' },
          { key: { email: 1 }, name: 'email_1', unique: true },
        ];
      },
    },
  ]);

  assert.deepEqual(result, {
    modelsChecked: 1,
    readsPassed: 1,
    indexesExpected: 1,
    indexesPresent: 1,
  });
  assert.deepEqual(calls, ['read', 'listIndexes']);
});

test('reports a missing compound index when key order differs', async () => {
  await assert.rejects(
    verifyModels([
      {
        collectionName: 'sessions',
        indexes: [
          {
            key: { userId: 1, expires: 1 },
            options: { expireAfterSeconds: 0 },
          },
        ],
        async readIdOnly() {},
        async listIndexes() {
          return [{ key: { expires: 1, userId: 1 }, expireAfterSeconds: 0 }];
        },
      },
    ]),
    (error: unknown) =>
      error instanceof MigrationCheckError &&
      error.code === 'DECLARED_INDEX_MISSING',
  );
});

test('sanitises application read and index inspection failures', async t => {
  await t.test('read failure', async () => {
    await assert.rejects(
      verifyModels([
        {
          collectionName: 'users',
          indexes: [],
          async readIdOnly() {
            throw new Error('mongodb://private-host/secret-db');
          },
          async listIndexes() {
            return [];
          },
        },
      ]),
      (error: unknown) =>
        error instanceof MigrationCheckError &&
        error.code === 'APPLICATION_READ_FAILED' &&
        !error.message.includes('private-host'),
    );
  });

  await t.test('index failure', async () => {
    await assert.rejects(
      verifyModels([
        {
          collectionName: 'users',
          indexes: [],
          async readIdOnly() {},
          async listIndexes() {
            throw new Error('mongodb://private-host/secret-db');
          },
        },
      ]),
      (error: unknown) =>
        error instanceof MigrationCheckError &&
        error.code === 'INDEX_READ_FAILED' &&
        !error.message.includes('private-host'),
    );
  });
});
