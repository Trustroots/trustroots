/** Adds `Model.paginate(query, options, [callback])`. */
async function paginateQuery(Model, query = {}, options = {}) {
  const { select, sort, populate, lean = false, leanWithId = true } = options;
  const limit = 'limit' in options ? options.limit : 10;
  let skip;
  let offset;
  let page;

  if ('offset' in options) {
    offset = options.offset;
    skip = offset;
  } else if ('page' in options) {
    page = options.page;
    skip = (page - 1) * limit;
  } else {
    offset = 0;
    page = 1;
    skip = offset;
  }

  const countPromise = Model.countDocuments(query).exec();
  let docsPromise = Promise.resolve([]);

  if (limit) {
    const docsQuery = Model.find(query)
      .select(select)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(lean);

    [].concat(populate || []).forEach(item => docsQuery.populate(item));

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
  const result = { docs, total, limit };

  if (offset !== undefined) {
    result.offset = offset;
  }

  if (page !== undefined) {
    result.page = page;
    result.pages = Math.ceil(total / limit) || 1;
  }

  return result;
}

export default function mongoosePaginate(schema) {
  schema.statics.paginate = function paginate(query, options, callback) {
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
