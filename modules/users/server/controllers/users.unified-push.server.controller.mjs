import dependency0 from './../services/unified-push.server.service.mjs';
let service = {};
const { pushConfiguration, validRegistration, register, unregister } =
  dependency0;
function configuration(req, res) {
  res.json(pushConfiguration());
}
async function add(req, res) {
  if (!pushConfiguration().enabled)
    return res.status(503).json({
      message: 'Message alerts are not configured.',
    });
  if (!validRegistration(req.body || {}))
    return res.status(400).json({
      message: 'Invalid push endpoint or encryption keys.',
    });
  try {
    await register(req.user._id, req.body);
    return res.status(204).end();
  } catch (error) {
    return res.status(500).json({
      message: 'Could not register message alerts.',
    });
  }
}
async function remove(req, res) {
  const endpoint = req.body && req.body.endpoint;
  if (typeof endpoint !== 'string' || !endpoint)
    return res.status(400).json({
      message: 'Endpoint is required.',
    });
  try {
    await unregister(req.user._id, endpoint);
    return res.status(204).end();
  } catch (error) {
    return res.status(500).json({
      message: 'Could not remove message alerts.',
    });
  }
}
service = {
  configuration,
  add,
  remove,
};
export default service;
export { service as 'module.exports' };

const nativeExportconfiguration = service.configuration;
export { nativeExportconfiguration as configuration };

const nativeExportadd = service.add;
export { nativeExportadd as add };

const nativeExportremove = service.remove;
export { nativeExportremove as remove };
