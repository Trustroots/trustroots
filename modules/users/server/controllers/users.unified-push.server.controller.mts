import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import {
  pushConfiguration,
  validRegistration,
  register,
  unregister,
  default as pushService,
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
async function test(req: PushRequest, res: Response): Promise<Response> {
  if (!pushConfiguration().enabled)
    return res
      .status(503)
      .json({ message: 'Message alerts are not configured.' });
  const endpoint = (req.body as { endpoint?: unknown } | undefined)?.endpoint;
  if (typeof endpoint !== 'string' || !endpoint || endpoint.length > 2048)
    return res.status(400).json({ message: 'Invalid push endpoint.' });

  try {
    const result = await pushService.scheduleTest(req.user._id, endpoint);
    if (result === 'missing')
      return res
        .status(404)
        .json({ message: 'Message alerts are not registered on this device.' });
    if (result === 'limited')
      return res.status(429).json({
        message: 'Please wait a minute before requesting another test.',
      });
    return res.status(202).end();
  } catch {
    return res
      .status(500)
      .json({ message: 'Could not schedule the test notification.' });
  }
}

interface UnifiedPushController {
  configuration: typeof configuration;
  add: typeof add;
  remove: typeof remove;
  test: typeof test;
}

const service: UnifiedPushController = {
  configuration,
  add,
  remove,
  test,
};
export default service;

const nativeExportconfiguration = service.configuration;
/** @esmNamed */
export { nativeExportconfiguration as configuration };

const nativeExportadd = service.add;
/** @esmNamed */
export { nativeExportadd as add };

const nativeExportremove = service.remove;
/** @esmNamed */
export { nativeExportremove as remove };
