import React, { useEffect, useState } from 'react';
import {
  getLocationCorrections,
  sendLocationCorrection,
} from '../api/location-corrections.api';
import AdminHeader from './AdminHeader.component';

function offerEditUrl(offer) {
  return offer.type === 'host' ? '/offer/host' : `/offer/meet/${offer._id}`;
}

function initialMessage(candidate) {
  const links = Array.from(
    new Set(
      candidate.offers.map(
        offer => `${window.location.origin}${offerEditUrl(offer)}`,
      ),
    ),
  ).join('\n');
  return `Hello ${
    candidate.displayName || candidate.username
  },\n\nOne or more of your Trustroots offers currently appears near a location that was once used as the map's starting point. Could you check that each location is correct? If a location needs changing, you can edit your offers here:\n${links}\n\nThank you!`;
}

export default function AdminLocationCorrections() {
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    getLocationCorrections()
      .then(data => {
        if (mounted) setCandidates(data);
      })
      .catch(() => {
        if (mounted) setError('Could not load location corrections.');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  function review(candidate) {
    setSelected(candidate);
    setContent(initialMessage(candidate));
    setError('');
    setNotice('');
  }

  async function send(event) {
    event.preventDefault();
    if (!selected || !content.trim() || isSending) return;
    setIsSending(true);
    setError('');
    try {
      const result = await sendLocationCorrection(
        selected.userId,
        selected.key,
        content,
      );
      setCandidates(current =>
        current.filter(item => item.userId !== selected.userId),
      );
      setNotice(
        result.sent
          ? `Message sent to ${selected.displayName || selected.username}.`
          : `${
              selected.displayName || selected.username
            } has already been contacted.`,
      );
      setSelected(null);
      setContent('');
    } catch (sendError) {
      setError(
        sendError.response?.data?.message || 'Could not send the message.',
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <AdminHeader />
      <main className="container">
        <h1>Location corrections</h1>
        <p>
          These offers are at or near the map’s former starting point. Nearby
          members may genuinely live there; review each offer before writing.
        </p>
        {isLoading && <p>Loading candidates…</p>}
        {error && (
          <p className="alert alert-danger" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="alert alert-success" role="status">
            {notice}
          </p>
        )}
        {!isLoading && !error && candidates.length === 0 && (
          <p>No uncontacted candidates found.</p>
        )}
        {!isLoading &&
          ['exact', 'nearby'].map(match => {
            const members = candidates.filter(
              candidate => candidate.match === match,
            );
            return members.length ? (
              <section key={match}>
                <h2>
                  {match === 'exact'
                    ? 'Exact former default'
                    : 'Nearby for review'}
                </h2>
                <ul className="list-unstyled">
                  {members.map(candidate => (
                    <li key={candidate.userId} className="panel panel-default">
                      <div className="panel-body">
                        <a href={`/profile/${candidate.username}`}>
                          {candidate.displayName || candidate.username}
                        </a>{' '}
                        ({candidate.username}) · {candidate.offers.length} offer
                        {candidate.offers.length === 1 ? '' : 's'}
                        <button
                          className="btn btn-default pull-right"
                          type="button"
                          onClick={() => review(candidate)}
                        >
                          Review {candidate.username}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null;
          })}
        {selected && (
          <section
            aria-label="Review location correction"
            className="panel panel-default"
          >
            <div className="panel-body">
              <h2>Review {selected.displayName || selected.username}</h2>
              <p>
                {selected.match === 'exact'
                  ? 'Exact former default location'
                  : 'Nearby location: verify before contacting'}
              </p>
              <ul>
                {selected.offers.map(offer => (
                  <li key={offer._id}>
                    {offer.type === 'host' ? 'Hosting' : 'Meeting'} offer at{' '}
                    {offer.location.join(', ')}
                  </li>
                ))}
              </ul>
              <form onSubmit={send}>
                <label htmlFor="location-correction-message">
                  Message from your account
                </label>
                <textarea
                  className="form-control"
                  id="location-correction-message"
                  maxLength={5000}
                  onChange={event => setContent(event.target.value)}
                  rows={8}
                  value={content}
                />
                <button
                  className="btn btn-primary"
                  disabled={isSending || !content.trim()}
                  type="submit"
                >
                  Send message
                </button>{' '}
                <button
                  className="btn btn-default"
                  type="button"
                  onClick={() => setSelected(null)}
                >
                  Cancel
                </button>
              </form>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
