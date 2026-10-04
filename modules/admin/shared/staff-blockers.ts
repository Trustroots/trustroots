/** A public identity exposed by the staff-blocker administration endpoint. */
export interface StaffBlockerMember<Id = string> {
  _id: Id;
  username?: string;
  displayName?: string;
}

/** One staff member and the members who have blocked them. */
export interface StaffBlocker<Id = string> extends StaffBlockerMember<Id> {
  blockedBy: StaffBlockerMember<Id>[];
}
