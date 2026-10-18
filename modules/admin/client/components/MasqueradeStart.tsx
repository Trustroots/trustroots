import React, { useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import http, { getErrorMessage } from '@/modules/core/client/api/http-client';
import { viewNavigation } from '@/modules/core/client/services/member-view';

export default function MasqueradeStart({ targetId }: { targetId: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  function close() {
    if (pending) return;
    setOpen(false);
    setPassword('');
    setReason('');
    setError('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const { data } = await http.post('/api/auth/masquerade', {
        targetId,
        password,
        reason,
      });
      setPassword('');
      viewNavigation.transition(data.redirect);
    } catch (error) {
      setPassword('');
      setError(getErrorMessage(error, 'Could not start the member view.'));
      setPending(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="btn btn-default"
        onClick={() => setOpen(true)}
      >
        View as this member
      </button>
      <Modal show={open} onHide={close} aria-labelledby="member-view-title">
        <form onSubmit={submit}>
          <Modal.Header closeButton={!pending}>
            <Modal.Title id="member-view-title">
              View as this member
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>
              This opens the member’s view, including private pages such as
              their inbox. You cannot make changes. Access is logged and ends
              after 15 minutes.
            </p>
            <label htmlFor="member-view-password">Your password</label>
            <input
              id="member-view-password"
              className="form-control"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              disabled={pending}
              onChange={event => setPassword(event.target.value)}
            />
            <label htmlFor="member-view-reason">Investigation reason</label>
            <textarea
              id="member-view-reason"
              className="form-control"
              required
              maxLength={500}
              value={reason}
              disabled={pending}
              onChange={event => setReason(event.target.value)}
            />
            {error && <p role="alert">{error}</p>}
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="btn btn-default"
              disabled={pending}
              onClick={close}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={pending}
            >
              {pending ? 'Opening…' : 'Open read-only view'}
            </button>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  );
}
