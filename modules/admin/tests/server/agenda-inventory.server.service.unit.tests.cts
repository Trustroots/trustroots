const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const sinon: typeof import('sinon') = require('sinon');
const {
  readSavedAgendaInventory,
}: typeof import('../../server/services/agenda-inventory.server.service.mts') = require('../../server/services/agenda-inventory.server.service.mts');

describe('Saved Agenda inventory', () => {
  it('reads the latest snapshot with a bounded query and returns its public fields', async () => {
    const snapshot = { jobs: [], jobsCapturedAt: '2025-03-30T12:00:00.000Z' };
    const findOne = sinon.stub().resolves({ _id: 'latest', ...snapshot });
    const collection = sinon.stub().returns({ findOne });

    assert.deepEqual(
      await readSavedAgendaInventory({ collection } as never),
      snapshot,
    );
    sinon.assert.calledOnceWithExactly(collection, 'agendaInventory');
    sinon.assert.calledOnceWithExactly(
      findOne,
      { _id: 'latest' },
      { timeoutMS: 5_000 },
    );
  });

  it('returns null when there is no saved snapshot', async () => {
    const findOne = sinon.stub().resolves(null);
    const collection = sinon.stub().returns({ findOne });

    assert.equal(await readSavedAgendaInventory({ collection } as never), null);
  });
});
