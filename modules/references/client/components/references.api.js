export async function create(reference) {
  await fetch('/api/references', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(reference) // eslint-disable-line angular/json-functions
  });
}

export async function report(user, message) {
  await fetch('/api/support', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ // eslint-disable-line angular/json-functions
      message,
      reportMember: user.username
    })
  });
}
