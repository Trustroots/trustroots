/**
 * @template Id
 * @param {import('../../shared/staff-blockers.js').StaffBlockerMember<Id>[]} staffMembers
 * @param {(import('../../shared/staff-blockers.js').StaffBlockerMember<Id> & { blocked: { equals: (id: Id) => boolean }[] })[]} blockers
 * @returns {import('../../shared/staff-blockers.js').StaffBlocker<Id>[]}
 */
export function prepareStaffBlockers(staffMembers, blockers) {
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
