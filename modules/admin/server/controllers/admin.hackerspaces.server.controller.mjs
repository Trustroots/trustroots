import { fetchSpaceApiCollector } from '../services/hackerspaces.server.service.mjs';

export async function preview(req, res) {
  try {
    res.json(await fetchSpaceApiCollector());
  } catch (error) {
    res.status(502).json({
      message: error?.message || 'Could not fetch the SpaceAPI Collector.',
    });
  }
}
const defaultInterop = { preview };
export default defaultInterop;
export { defaultInterop as 'module.exports' };
