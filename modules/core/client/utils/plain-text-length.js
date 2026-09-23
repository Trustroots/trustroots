export default function plainTextLength(string) {
  return typeof string === 'string'
    ? string
        .replace(/&nbsp;/g, ' ')
        .replace(/<[^>]+>/gm, '')
        .trim().length
    : 0;
}
