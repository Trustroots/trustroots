import React, { useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from '@trustroots/ui/Modal';
import { unsuspendMember } from '../api/users.api';

export default function UnsuspendMember({
  member,
  onRefresh,
}: {
  member: { _id: string; username?: string };
  onRefresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<'operation' | 'refresh' | null>(null);
  const invalidReason = !reason.trim() || reason.trim().length > 1000;

  async function confirm() {
    let unsuspended = completed;
    setPending(true);
    setError(null);
    try {
      if (!unsuspended) {
        await unsuspendMember(member._id, reason.trim());
        unsuspended = true;
        setCompleted(true);
      }
      await onRefresh();
      setOpen(false);
    } catch {
      setError(unsuspended ? 'refresh' : 'operation');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setReason('');
          setError(null);
          setCompleted(false);
          setOpen(true);
        }}
      >
        Unsuspend
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} dismissible={!pending}>
        <ModalHeader>
          <ModalTitle>Unsuspend {member.username || member._id}?</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p>
            This removes the suspension. Other roles, profile visibility and
            subscriptions are retained.
          </p>
          <label htmlFor="unsuspend-reason">Administrator reason</label>
          <textarea
            id="unsuspend-reason"
            className="form-control"
            value={reason}
            required
            maxLength={1000}
            disabled={pending || completed}
            onChange={event => setReason(event.target.value)}
          />
          {error === 'operation' && (
            <p role="alert">
              Could not confirm unsuspension. Close this dialog and refresh the
              member report before trying again.
            </p>
          )}
          {error === 'refresh' && (
            <p role="alert">
              The suspension was removed, but the member report could not be
              refreshed. Try refreshing the report again.
            </p>
          )}
          {pending && <p role="status">Updating member report…</p>}
        </ModalBody>
        <ModalFooter>
          <Button
            type="button"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || (!completed && invalidReason)}
            onClick={() => void confirm()}
          >
            {completed ? 'Refresh report' : 'Confirm unsuspension'}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
