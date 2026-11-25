export const publicTribeFields = [
  '_id',
  'slug',
  'label',
  'count',
  'color',
  'image',
  'attribution',
  'attribution_url',
  'description',
  'created',
].join(' ');

export function publicMemberTribePopulateOptions() {
  return {
    path: 'member.tribe',
    select: publicTribeFields,
    model: 'Tribe',
  };
}
