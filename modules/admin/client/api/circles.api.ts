import axios from 'axios';

export type AdminCircle = {
  _id?: string;
  slug?: string;
  label: string;
  color?: string;
  public: boolean;
  count?: number;
  attribution?: string;
  attribution_url?: string;
  description?: string;
  image?: boolean;
};

export async function getCircles(): Promise<AdminCircle[]> {
  const { data } = await axios.get<AdminCircle[]>('/api/admin/circles');
  return data;
}

export async function saveCircle(
  circle: AdminCircle,
  image?: File | null,
): Promise<AdminCircle> {
  let payload: AdminCircle | FormData = circle;
  if (image) {
    const formData = new FormData();
    Object.entries(circle).forEach(([key, value]) =>
      formData.append(key, value == null ? '' : String(value)),
    );
    formData.append('image', image);
    payload = formData;
  }
  const url = circle._id
    ? `/api/admin/circles/${circle._id}`
    : '/api/admin/circles';
  const method = circle._id ? 'put' : 'post';
  const { data } = await axios[method]<AdminCircle>(url, payload);
  return data;
}
