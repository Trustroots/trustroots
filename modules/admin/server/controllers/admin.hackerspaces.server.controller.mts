import { fetchSpaceApiCollector } from '../services/hackerspaces.server.service.mts';

interface JsonResponse {
  status(code: number): JsonResponse;
  json(body: unknown): unknown;
}

function getErrorMessage(error: unknown): unknown {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return undefined;
  }
  return error.message;
}

export async function preview(_req: unknown, res: JsonResponse): Promise<void> {
  try {
    res.json(await fetchSpaceApiCollector());
  } catch (error) {
    res.status(502).json({
      message:
        getErrorMessage(error) || 'Could not fetch the SpaceAPI Collector.',
    });
  }
}
const defaultInterop = { preview };
export default defaultInterop;
export { defaultInterop as 'module.exports' };
