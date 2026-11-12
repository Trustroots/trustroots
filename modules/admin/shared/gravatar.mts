export const gravatarSortColumns = ['username', 'displayName', 'seen'] as const;

export interface GravatarSort {
  column: (typeof gravatarSortColumns)[number];
  direction: 'ascending' | 'descending';
}
