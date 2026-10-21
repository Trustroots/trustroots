const { createTaskQueue, forEachWithConcurrency } =
  require('./../../../server/services/task-queue.server.service.mts') as typeof import('./../../../server/services/task-queue.server.service.mts');
require('should');

type Deferred = { resolve(): void; promise: Promise<void> };

function defer(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { resolve, promise };
}

function nextTurn() {
  return new Promise(resolve => setImmediate(resolve));
}

describe('Task queue service unit tests', () => {
  it('counts tasks pushed in the same turn as waiting', () => {
    const queue = createTaskQueue<number>(async () => {}, 1);

    queue.push(1);
    queue.push(2);

    queue.length().should.equal(2);
  });

  it('runs tasks in push order with bounded concurrency', async () => {
    const started: number[] = [];
    const running = new Map<number, Deferred>();
    const queue = createTaskQueue<number>(task => {
      started.push(task);
      const deferred = defer();
      running.set(task, deferred);
      return deferred.promise;
    }, 2);

    [1, 2, 3, 4].forEach(task => queue.push(task));
    await nextTurn();

    started.should.deepEqual([1, 2]);
    queue.length().should.equal(2);

    running.get(2)!.resolve();
    await nextTurn();

    started.should.deepEqual([1, 2, 3]);
    queue.length().should.equal(1);

    running.get(1)!.resolve();
    running.get(3)!.resolve();
    await nextTurn();

    started.should.deepEqual([1, 2, 3, 4]);
    queue.length().should.equal(0);
  });

  describe('forEachWithConcurrency', () => {
    it('starts items in order without exceeding the limit', async () => {
      const started: Array<[number, number]> = [];
      const running = new Map<number, Deferred>();
      const done = forEachWithConcurrency(
        [10, 20, 30, 40],
        2,
        (item, index) => {
          started.push([item, index]);
          const deferred = defer();
          running.set(item, deferred);
          return deferred.promise;
        },
      );

      await nextTurn();
      started.should.deepEqual([
        [10, 0],
        [20, 1],
      ]);

      running.get(20)!.resolve();
      await nextTurn();
      started.should.deepEqual([
        [10, 0],
        [20, 1],
        [30, 2],
      ]);

      running.get(10)!.resolve();
      running.get(30)!.resolve();
      await nextTurn();
      started.length.should.equal(4);

      running.get(40)!.resolve();
      await done;
    });

    it('starts at most one call per item when the limit exceeds the items', async () => {
      const seen: number[] = [];
      await forEachWithConcurrency([1, 2], 10, async item => {
        seen.push(item);
      });
      seen.should.deepEqual([1, 2]);
    });

    it('resolves without calling fn for empty input', async () => {
      let calls = 0;
      await forEachWithConcurrency([], 3, async () => {
        calls += 1;
      });
      calls.should.equal(0);
    });

    it('rejects with the rejection of fn', async () => {
      const failure = new Error('boom');
      await forEachWithConcurrency([1, 2, 3], 2, async item => {
        if (item === 2) throw failure;
      }).should.be.rejectedWith(failure);
    });

    it('stops starting new items after a rejection', async () => {
      const seen: number[] = [];
      await forEachWithConcurrency([1, 2, 3, 4], 1, async item => {
        seen.push(item);
        if (item === 2) throw new Error('boom');
      }).should.be.rejected();
      seen.should.deepEqual([1, 2]);
    });
  });
});
