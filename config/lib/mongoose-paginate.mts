import type {
  Schema,
  Model,
  QueryFilter,
  PopulateOptions,
  SortOrder,
  ProjectionType,
} from 'mongoose';
interface PaginateRecord {
  _id: unknown;
  id?: string;
}
export interface PaginateOptions {
  select?: ProjectionType<PaginateRecord>;
  sort?: string | Record<string, SortOrder>;
  populate?: string | PopulateOptions | Array<string | PopulateOptions>;
  lean?: boolean;
  leanWithId?: boolean;
  limit?: number;
  offset?: number;
  page?: number;
}
export interface PaginateResult<T> {
  docs: T[];
  total: number;
  limit: number;
  offset?: number;
  page?: number;
  pages?: number;
}
/** Adds `Model.paginate(query, options, [callback])`. */
async function paginateQuery(
  Model: Model<PaginateRecord>,
  query: QueryFilter<PaginateRecord> = {},
  options: PaginateOptions = {},
) {
  const { select, sort, populate, lean = false, leanWithId = true } = options;
  const limit = 'limit' in options ? options.limit! : 10;
  let skip;
  let offset;
  let page;

  if ('offset' in options) {
    offset = options.offset!;
    skip = offset;
  } else if ('page' in options) {
    page = options.page!;
    skip = (page - 1) * limit;
  } else {
    offset = 0;
    page = 1;
    skip = offset;
  }

  const countPromise = Model.countDocuments(query).exec();
  let docsPromise: Promise<PaginateRecord[]> = Promise.resolve([]);

  if (limit) {
    const docsQuery = Model.find(query)
      .select(select!)
      .sort(sort!)
      .skip(skip!)
      .limit(limit)
      .lean<PaginateRecord[]>(lean);

    const populations = ([] as Array<string | PopulateOptions>).concat(
      populate || [],
    );
    populations.forEach(item =>
      (docsQuery.populate as (value: string | PopulateOptions) => unknown)(
        item,
      ),
    );

    docsPromise = docsQuery.exec();

    if (lean && leanWithId) {
      docsPromise = docsPromise.then(docs => {
        docs.forEach(doc => {
          doc.id = String(doc._id);
        });
        return docs;
      });
    }
  }

  const [docs, total] = await Promise.all([docsPromise, countPromise]);
  const result: PaginateResult<PaginateRecord> = { docs, total, limit };

  if (offset !== undefined) {
    result.offset = offset;
  }

  if (page !== undefined) {
    result.page = page;
    result.pages = Math.ceil(total / limit) || 1;
  }

  return result;
}

export default function mongoosePaginate(schema: Schema) {
  schema.statics.paginate = function paginate(
    this: Model<PaginateRecord>,
    query?: QueryFilter<PaginateRecord>,
    options?: PaginateOptions,
    callback?: (
      error: unknown,
      result?: PaginateResult<PaginateRecord>,
    ) => void,
  ) {
    const promise = paginateQuery(this, query, options);
    if (typeof callback !== 'function') {
      return promise;
    }
    promise.then(
      result => callback(null, result),
      error => callback(error),
    );
    return promise;
  };
}
