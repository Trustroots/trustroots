import axios, { type AxiosResponse } from 'axios';

import {
  getCircles,
  saveCircle,
  type AdminCircle,
} from '@/modules/admin/client/api/circles.api';

const axiosMock = vi.mocked(axios);
const AxiosHeaders = (await vi.importActual<typeof import('axios')>('axios'))
  .AxiosHeaders;

function response<T>(data: T): AxiosResponse<T> {
  const headers = new AxiosHeaders();
  return { data, status: 200, statusText: 'OK', headers, config: { headers } };
}

vi.mock(
  'axios',
  async () => await import('@/modules/core/tests/client/api/axios.mock.js'),
);

afterEach(() => {
  vi.clearAllMocks();
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
  const circle: AdminCircle = {
    _id: 'circle-1',
    label: 'Walkers',
    public: false,
    description: undefined,
    organisers: [{ _id: 'member-1', username: 'sample-member' }],
  };
  const image = new File(['image'], 'circle.png', { type: 'image/png' });
  axiosMock.put.mockResolvedValueOnce(response(circle));
  await expect(saveCircle(circle, image)).resolves.toEqual(circle);
  const [url, data] = axiosMock.put.mock.calls[0] as [string, FormData];
  expect(url).toBe('/api/admin/circles/circle-1');
  expect(data).toBeInstanceOf(FormData);
  expect(data.get('label')).toBe('Walkers');
  expect(data.get('public')).toBe('false');
  expect(data.get('description')).toBe('');
  expect(data.get('color')).toBe('');
  expect(data.get('attribution')).toBe('');
  expect(data.get('attribution_url')).toBe('');
  expect(data.get('_id')).toBeNull();
  expect(data.get('slug')).toBeNull();
  expect(data.get('count')).toBeNull();
  expect(data.get('organiserIds')).toBe('["member-1"]');
  expect(data.get('image')).toEqual(image);
  expect(Array.from(data.keys())).toEqual([
    'label',
    'color',
    'public',
    'attribution',
    'attribution_url',
    'description',
    'organiserIds',
    'image',
  ]);
});

it('sends an empty organiser list to clear assignments', async () => {
  const circle = { _id: 'circle-1', label: 'Walkers', public: true };
  axiosMock.put.mockResolvedValueOnce(response(circle));
  await expect(saveCircle({ ...circle, organisers: [] })).resolves.toEqual({
    ...circle,
    organisers: [],
  });
  expect(axiosMock.put).toHaveBeenCalledWith('/api/admin/circles/circle-1', {
    ...circle,
    organiserIds: [],
  });
});

it('omits organiser IDs when uploading an image without changing assignments', async () => {
  const circle = { _id: 'circle-1', label: 'Walkers', public: true };
  const image = new File(['image'], 'circle.png');
  axiosMock.put.mockResolvedValueOnce(response(circle));
  await saveCircle(circle, image);
  const [, payload] = axiosMock.put.mock.calls[0] as [string, FormData];
  expect(payload.has('organiserIds')).toBe(false);
});
