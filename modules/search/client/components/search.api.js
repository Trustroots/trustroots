export async function searchUsers(query) {
  const response = await fetch(`/api/users?search=${query}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    }
  });

  return await response.json();
}
