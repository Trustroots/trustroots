export function directRequest(req, Member) {
  // ruleid: request-object-in-database-filter
  return Member.find(req.query);
}

export function copiedRequest(req, Member) {
  const filter = req.body;
  // ruleid: request-object-in-database-filter
  return Member.findOne(filter);
}

export function nestedRequest(req, Member) {
  // ruleid: request-object-in-database-filter
  return Member.findOne({ username: req.body.username });
}

export function spreadRequest(req, Member) {
  // ruleid: request-object-in-database-filter
  return Member.find({ ...req.query });
}

export function updateFilter(req, Member) {
  // ruleid: request-object-in-database-filter
  return Member.updateOne(req.params, { active: false });
}

export function deleteFilter(req, Member) {
  // ruleid: request-object-in-database-filter
  return Member.deleteMany(req.body);
}

export function scalarFilter(req, Member) {
  // ok: request-object-in-database-filter
  return Member.findOne({ username: String(req.body.username) });
}

export function numericFilter(req, Member) {
  // ok: request-object-in-database-filter
  return Member.find({ count: Number(req.query.count) });
}

export function constantFilter(Member) {
  // ok: request-object-in-database-filter
  return Member.find({ username: 'fictional-member' });
}
