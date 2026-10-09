import axios, { type AxiosResponse } from 'axios';

import { getCircles, saveCircle } from '@/modules/admin/client/api/circles.api';

const axiosMock = jest.mocked(axios);
const AxiosHeaders =
  jest.requireActual<typeof import('axios')>('axios').AxiosHeaders;

function response<T>(data: T): AxiosResponse<T> {
  const headers = new AxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock.js'),
);

afterEach(() => {
  jest.clearAllMocks();
});

type CircleFixture = {
  _id?: string;
  label: string;
  public: boolean;
};

it('loads the admin circle catalogue', async () => {
  const data = [{ _id: 'circle-1', label: 'Walkers', public: true }];
  axiosMock.get.mockResolvedValueOnce(response(data));
  await expect(getCircles()).resolves.toBe(data);
  expect(axiosMock.get).toHaveBeenCalledWith('/api/admin/circles');
});

it.each([undefined, 'circle-1'])(
  'saves metadata as JSON (id: %s)',
  async id => {
    const circle: CircleFixture = { label: 'Walkers', public: false };
    if (id) circle._id = id;
    const method = id ? 'put' : 'post';
    axiosMock[method].mockResolvedValueOnce(response(circle));
    await expect(saveCircle(circle)).resolves.toBe(circle);
    expect(axiosMock[method]).toHaveBeenCalledWith(
      id ? `/api/admin/circles/${id}` : '/api/admin/circles',
      circle,
    );
  },
);

it('sends multipart data when uploading an image', async () => {
  const circle: CircleFixture & { description?: string } = {
    _id: 'circle-1',
    label: 'Walkers',
    public: false,
    description: undefined,
  };
  const image = new File(['image'], 'circle.png', { type: 'image/png' });
  axiosMock.put.mockResolvedValueOnce(response(circle));
  await expect(saveCircle(circle, image)).resolves.toBe(circle);
  const [url, data] = axiosMock.put.mock.calls[0] as [string, FormData];
  expect(url).toBe('/api/admin/circles/circle-1');
  expect(data).toBeInstanceOf(FormData);
  expect(data.get('label')).toBe('Walkers');
  expect(data.get('public')).toBe('false');
  expect(data.get('description')).toBe('');
  expect(data.get('image')).toEqual(image);
});
