// Evaluate the authoritative website policy against its registered ACL path.
// Use a request-local view: Express shares route objects between requests.
module.exports = function mobileResourcePolicy(policy, path) {
  return function (req, res, next) {
    const policyRequest = Object.create(req);
    policyRequest.route = { ...req.route, path };
    return policy(policyRequest, res, next);
  };
};
