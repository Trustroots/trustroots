import axios from 'axios';
import {
  getLocationCorrections,
  sendLocationCorrection,
} from '@/modules/admin/client/api/location-corrections.api';

jest.mock('axios');

describe('welcome team location correction API', () => {
  it('loads candidates', async () => {
    axios.get.mockResolvedValue({ data: [{ userId: 'member-1' }] });
    expect(await getLocationCorrections()).toEqual([{ userId: 'member-1' }]);
    expect(axios.get).toHaveBeenCalledWith('/api/admin/location-corrections');
  });

  it('sends a reviewed message', async () => {
    axios.post.mockResolvedValue({ data: { sent: true } });
    expect(await sendLocationCorrection('member-1', 'key', 'Hello')).toEqual({
      sent: true,
    });
    expect(axios.post).toHaveBeenCalledWith(
      '/api/admin/location-corrections/send',
      {
        userId: 'member-1',
        key: 'key',
        content: 'Hello',
      },
    );
  });
});
