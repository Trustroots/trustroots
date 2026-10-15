type Pair = {
  userFrom: unknown;
  userTo: unknown;
};

type PairFilter = {
  $or: [Pair, Pair];
};

type PopulateOptions = {
  path: 'userFrom' | 'userTo';
  select: 'username displayName';
  model: 'User';
};

type PairQuery<T> = {
  sort(sort: { created: 1 }): PairQuery<T>;
  populate(options: PopulateOptions): PairQuery<T>;
  exec(): Promise<T[] | null>;
};

type PairModel<T> = {
  find(filter: PairFilter): PairQuery<T>;
};

/** Find records for a user pair in either direction, with both users populated. */
export function findPairRecords<T>(
  model: PairModel<T>,
  user1: unknown,
  user2: unknown,
): PairQuery<T> {
  return model
    .find({
      $or: [
        {
          userFrom: user1,
          userTo: user2,
        },
        {
          userFrom: user2,
          userTo: user1,
        },
      ],
    })
    .sort({
      created: 1,
    })
    .populate({
      path: 'userFrom',
      select: 'username displayName',
      model: 'User',
    })
    .populate({
      path: 'userTo',
      select: 'username displayName',
      model: 'User',
    });
}
