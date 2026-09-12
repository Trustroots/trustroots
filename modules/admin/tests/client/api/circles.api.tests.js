import axios from 'axios';
import { getCircles, saveCircle } from '@/modules/admin/client/api/circles.api';

jest.mock('axios');

afterEach(() => jest.clearAllMocks());

it('loads the admin circle catalogue', async () => {
  const data = [{ _id: 'circle-1' }];
  axios.get.mockResolvedValueOnce({ data });
  await expect(getCircles()).resolves.toBe(data);
  expect(axios.get).toHaveBeenCalledWith('/api/admin/circles');
});

it.each([undefined, 'circle-1'])(
  'saves metadata as JSON (id: %s)',
  async id => {
    const circle = { label: 'Walkers', public: false };
    if (id) circle._id = id;
    axios.mockResolvedValueOnce({ data: circle });
    await expect(saveCircle(circle)).resolves.toBe(circle);
    expect(axios).toHaveBeenCalledWith({
      data: circle,
      method: id ? 'put' : 'post',
      url: id ? `/api/admin/circles/${id}` : '/api/admin/circles',
    });
  },
);

it('sends multipart data when uploading an image', async () => {
  const circle = { _id: 'circle-1', label: 'Walkers', public: false };
  const image = new File(['image'], 'circle.png', { type: 'image/png' });
  axios.mockResolvedValueOnce({ data: circle });
  await expect(saveCircle(circle, image)).resolves.toBe(circle);
  const { data, headers } = axios.mock.calls[0][0];
  expect(data).toBeInstanceOf(FormData);
  expect(data.get('label')).toBe('Walkers');
  expect(data.get('public')).toBe('false');
  expect(data.get('image')).toEqual(image);
  expect(headers).toBeUndefined();
});
