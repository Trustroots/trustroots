export async function create(reference) {
  await fetch('/api/references', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
      // "Content-Type": "application/x-www-form-urlencoded",
    },
    body: JSON.stringify(reference) // eslint-disable-line angular/json-functions
  });
}
