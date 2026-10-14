import type {
  StaffBlocker,
  StaffBlockerMember,
} from '../../shared/staff-blockers.js';

type BlockedMember<Id> = StaffBlockerMember<Id> & {
  blocked: { equals: (id: Id) => boolean }[];
};

export function prepareStaffBlockers<Id>(
  staffMembers: StaffBlockerMember<Id>[],
  blockers: BlockedMember<Id>[],
): StaffBlocker<Id>[] {
  return staffMembers.map(staff => ({
    _id: staff._id,
    username: staff.username,
    displayName: staff.displayName,
    blockedBy: blockers
      .filter(blocker => blocker.blocked.some(id => id.equals(staff._id)))
      .map(({ _id, username, displayName }) => ({
        _id,
        username,
        displayName,
      })),
  }));
}
