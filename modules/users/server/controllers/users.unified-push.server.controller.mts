import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import {
  pushConfiguration,
  validRegistration,
  register,
  unregister,
} from './../services/unified-push.server.service.mjs';
interface PushRequest extends Request {
  body: unknown;
  user: { _id: Types.ObjectId };
}

function configuration(_req: Request, res: Response): void {
  res.json(pushConfiguration());
}
async function add(req: PushRequest, res: Response): Promise<Response | void> {
  if (!pushConfiguration().enabled)
    return res.status(503).json({
      message: 'Message alerts are not configured.',
    });
  const registration = req.body || {};
  if (!validRegistration(registration))
    return res.status(400).json({
      message: 'Invalid push endpoint or encryption keys.',
    });
  try {
    await register(req.user._id, registration);
    return res.status(204).end();
  } catch {
    return res.status(500).json({
      message: 'Could not register message alerts.',
    });
  }
}
async function remove(
  req: PushRequest,
  res: Response,
): Promise<Response | void> {
  const endpoint = req.body && (req.body as { endpoint?: unknown }).endpoint;
  if (typeof endpoint !== 'string' || !endpoint)
    return res.status(400).json({
      message: 'Endpoint is required.',
    });
  try {
    await unregister(req.user._id, endpoint);
    return res.status(204).end();
  } catch {
    return res.status(500).json({
      message: 'Could not remove message alerts.',
    });
  }
}
interface UnifiedPushController {
  configuration: typeof configuration;
  add: typeof add;
  remove: typeof remove;
}

const service: UnifiedPushController = {
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
