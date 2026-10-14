import axios from 'axios';
import {
  getLocationCorrections,
  sendLocationCorrection,
  type LocationCorrectionCandidate,
  type LocationCorrectionSendResult,
} from '@/modules/admin/client/api/location-corrections.api';

jest.mock('axios');

const getMock = axios.get as jest.MockedFunction<
  (url: string) => Promise<{ data: LocationCorrectionCandidate[] }>
>;
const postMock = axios.post as jest.MockedFunction<
  (
    url: string,
    payload: { userId: string; key: string; content: string },
  ) => Promise<{ data: LocationCorrectionSendResult }>
>;

describe('welcome team location correction API', () => {
  it('loads candidates', async () => {
    const candidates: LocationCorrectionCandidate[] = [
      {
        userId: 'member-1',
        username: 'member',
        key: 'candidate-key',
        match: 'exact',
        offers: [],
      },
    ];
    getMock.mockResolvedValue({ data: candidates });
    expect(await getLocationCorrections()).toEqual(candidates);
    expect(getMock).toHaveBeenCalledWith('/api/admin/location-corrections');
  });

  it('sends a reviewed message', async () => {
    postMock.mockResolvedValue({ data: { sent: true } });
    expect(await sendLocationCorrection('member-1', 'key', 'Hello')).toEqual({
      sent: true,
    });
    expect(postMock).toHaveBeenCalledWith(
      '/api/admin/location-corrections/send',
      {
        userId: 'member-1',
        key: 'key',
        content: 'Hello',
      },
    );
  });
});
