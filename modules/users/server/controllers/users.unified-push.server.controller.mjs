import {
  pushConfiguration,
  validRegistration,
  register,
  unregister,
} from '../services/unified-push.server.service.mjs';

export function configuration(req, res) {
  res.json(pushConfiguration());
}

export async function add(req, res) {
  if (!pushConfiguration().enabled)
    return res
      .status(503)
      .json({ message: 'Message alerts are not configured.' });
  if (!validRegistration(req.body || {}))
    return res
      .status(400)
      .json({ message: 'Invalid push endpoint or encryption keys.' });
  try {
    await register(req.user._id, req.body);
    return res.status(204).end();
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Could not register message alerts.' });
  }
}

export async function remove(req, res) {
  const endpoint = req.body && req.body.endpoint;
  if (typeof endpoint !== 'string' || !endpoint)
    return res.status(400).json({ message: 'Endpoint is required.' });
  try {
    await unregister(req.user._id, endpoint);
    return res.status(204).end();
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Could not remove message alerts.' });
  }
}
