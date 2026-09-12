import axios from 'axios';

export async function getCircles() {
  const { data } = await axios.get('/api/admin/circles');
  return data;
}

export async function saveCircle(circle, image) {
  let payload = circle;
  if (image) {
    payload = new FormData();
    Object.keys(circle).forEach(key => payload.append(key, circle[key]));
    payload.append('image', image);
  }
  const url = circle._id
    ? `/api/admin/circles/${circle._id}`
    : '/api/admin/circles';
  const { data } = await axios({
    data: payload,
    method: circle._id ? 'put' : 'post',
    url,
  });
  return data;
}
