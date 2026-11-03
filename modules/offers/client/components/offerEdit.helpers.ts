export function plainTextLength(value = ''): number {
  const document = new DOMParser().parseFromString(value, 'text/html');
  return (document.body.textContent || '').trim().length;
}
