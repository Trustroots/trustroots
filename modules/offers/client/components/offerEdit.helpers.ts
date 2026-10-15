export function plainTextLength(value = ''): number {
  return value.replace(/<[^>]*>/g, '').trim().length;
}
