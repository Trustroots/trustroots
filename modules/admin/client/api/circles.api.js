import axios from 'axios';

export async function getCircles() {
  const { data } = await axios.get('/api/admin/circles');
  return data;
}

export async function saveCircle(circle, image) {
  const form = new FormData();
  Object.keys(circle).forEach(key => form.append(key, circle[key]));
  if (image) form.append('image', image);
  const url = circle._id
    ? `/api/admin/circles/${circle._id}`
    : '/api/admin/circles';
  const { data } = await axios({
    data: form,
    headers: { 'Content-Type': 'multipart/form-data' },
    method: circle._id ? 'put' : 'post',
    url,
  });
  return data;
}
