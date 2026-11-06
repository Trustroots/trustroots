import React, { useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import { setMemberFlag } from '../api/support.api';

export default function MemberFlag({
  member,
  onChanged,
}: {
  member: { _id: string; roles: string[] };
  onChanged: (roles: string[]) => void;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const flagged = member.roles.includes('flagged');
  async function toggle() {
    setPending(true);
    setFailed(false);
    try {
      await setMemberFlag(member._id, !flagged);
      onChanged(
        flagged
          ? member.roles.filter(role => role !== 'flagged')
          : [...member.roles, 'flagged'],
      );
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <section aria-label="Moderation follow-up">
      <p>
        Internal follow-up only. This does not change account access or profile
        visibility.
      </p>
      <Button type="button" disabled={pending} onClick={toggle}>
        {flagged ? 'Remove flag' : 'Flag for follow-up'}
      </Button>
      {failed && (
        <p role="alert">Could not update the flag. Please try again.</p>
      )}
    </section>
  );
}
