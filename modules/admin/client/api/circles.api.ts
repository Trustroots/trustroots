import axios from '../../../core/client/api/http-client.js';

export type CircleOrganiser = {
  _id: string;
  username?: string;
  displayName?: string;
};

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
  modified?: string | Date;
  organisers?: CircleOrganiser[];
};

export async function getCircles(): Promise<AdminCircle[]> {
  const { data } = await axios.get<AdminCircle[]>('/api/admin/circles');
  return data;
}

const editableFields = [
  'label',
  'color',
  'public',
  'attribution',
  'attribution_url',
  'description',
] as const;

export async function saveCircle(
  circle: AdminCircle,
  image?: File | null,
): Promise<AdminCircle> {
  const { organisers, ...metadata } = circle;
  const organiserIds = organisers?.map(member => member._id);
  let payload: (typeof metadata & { organiserIds?: string[] }) | FormData =
    organiserIds === undefined ? metadata : { ...metadata, organiserIds };
  if (image) {
    const formData = new FormData();
    for (const field of editableFields) {
      const value = circle[field];
      formData.append(field, value == null ? '' : String(value));
    }
    if (organiserIds !== undefined) {
      formData.append('organiserIds', JSON.stringify(organiserIds));
    }
    formData.append('image', image);
    payload = formData;
  }
  const url = circle._id
    ? `/api/admin/circles/${circle._id}`
    : '/api/admin/circles';
  const method = circle._id ? 'put' : 'post';
  const { data } = await axios[method]<AdminCircle>(url, payload);
  return organisers === undefined ? data : { ...data, organisers };
}
