import React, { useEffect, useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import type { GravatarPhotoCheck } from '../../shared/gravatar-photo-check.mts';
import {
  getGravatarPhotoCheck,
  startGravatarPhotoCheck,
} from '../api/gravatar.api';
import { formatAdminDateTime } from '../utils/admin-date';

export default function AdminGravatarPhotoCheck({
  onCleanupFinished,
}: {
  onCleanupFinished: () => void;
}) {
  const [check, setCheck] = useState<GravatarPhotoCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [startError, setStartError] = useState(false);

  useEffect(() => {
    if (starting) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function refresh() {
      const result = await getGravatarPhotoCheck().catch(() => undefined);
      if (!active) return;

      if (result === undefined) {
        setLoadError(true);
        timer = setTimeout(refresh, 5000);
        return;
      }
      setCheck(result);
      if (result?.state === 'running') {
        timer = setTimeout(refresh, 2000);
      } else if (result?.retired) {
        onCleanupFinished();
      }
      setLoadError(false);
      setLoading(false);
    }

    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [starting, onCleanupFinished]);

  const busy = loading || starting || check?.state === 'running';

  async function start(cleanup = false) {
    setStarting(true);
    setStartError(false);
    try {
      setCheck(
        cleanup
          ? await startGravatarPhotoCheck(true)
          : await startGravatarPhotoCheck(),
      );
    } catch {
      setStartError(true);
    } finally {
      setStarting(false);
    }
  }

  return (
    <section aria-labelledby="gravatar-photo-check">
      <h3 id="gravatar-photo-check">Gravatar photo availability</h3>
      <p>
        The check queries Gravatar for all accounts with Gravatar selected and
        may take a while. Cleanup switches accounts to no photo when Gravatar
        confirms the image is missing.
      </p>
      <Button type="button" onClick={() => void start()} disabled={busy}>
        Check Gravatar photos
      </Button>{' '}
      <Button type="button" onClick={() => void start(true)} disabled={busy}>
        Switch missing Gravatars to no photo
      </Button>
      {loadError && (
        <p role="alert">Could not load photo check results. Retrying…</p>
      )}
      {startError && <p role="alert">Could not start the photo check.</p>}
      {check && (
        <>
          <p role="status">
            {check.state === 'running'
              ? `Checking photos… ${check.counts.available + check.counts.unavailable + check.counts.inconclusive} accounts checked.`
              : check.state === 'failed'
                ? 'Check stopped early. Counts are partial.'
                : 'Photo check complete.'}
          </p>
          <table className="table" aria-label="Gravatar photo check counts">
            <thead>
              <tr>
                <th scope="col">Image available</th>
                <th scope="col">No image available</th>
                <th scope="col">Inconclusive</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{check.counts.available}</td>
                <td>{check.counts.unavailable}</td>
                <td>{check.counts.inconclusive}</td>
              </tr>
            </tbody>
          </table>
          {check.retired !== undefined && (
            <p>{check.retired} accounts switched to no photo.</p>
          )}
          {check.finishedAt && (
            <p>
              Finished at{' '}
              <time dateTime={check.finishedAt}>
                {formatAdminDateTime(check.finishedAt)}
              </time>{' '}
              UTC.
            </p>
          )}
        </>
      )}
    </section>
  );
}
